import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stadiumApi, stadiumKeys, type StadiumLayoutCreatePayload } from '../api/stadiumApi';
import {
  defaultLabelingRule,
  detectAutomaticSeatCandidateIds,
  toLayoutElementPayload,
  toLayoutImportAreaPayload,
  validateLayoutDraft,
  validateStadiumInfo,
} from '../model/stadium.model';
import type { DraftArea, DraftLayoutElement } from '../model/stadium.types';
import { useStadiumEditorStore } from '../store/stadiumEditorStore';

export function useStadiumEditor() {
  const editor = useStadiumEditorStore();
  const queryClient = useQueryClient();
  const stadiums = useQuery({
    queryKey: stadiumKeys.list(),
    queryFn: stadiumApi.list,
  });
  const layouts = useQuery({
    queryKey: stadiumKeys.layouts(editor.stadiumId ?? 0),
    queryFn: () => stadiumApi.layouts(editor.stadiumId as number),
    enabled: editor.stadiumId !== null,
  });

  const createStadium = useMutation({
    retry: false,
    mutationFn: async () => {
      const validationError = validateStadiumInfo(editor.info);
      if (validationError) throw new Error(validationError);
      return stadiumApi.create(editor.info);
    },
    onSuccess: (response) => {
      editor.setStadiumId(response.stadiumId);
      editor.goToStep(2);
    },
  });

  const startFromLayout = useMutation({
    retry: false,
    mutationFn: async (sourceLayoutId: number) => {
      const [detail, areaList] = await Promise.all([
        stadiumApi.layoutDetail(sourceLayoutId),
        stadiumApi.layoutAreas(sourceLayoutId),
      ]);

      const areas: DraftArea[] = await Promise.all(
        areaList.areas.map(async (area): Promise<DraftArea> => {
          const seatList = area.type === 'SEATED' ? await stadiumApi.areaSeats(area.areaId) : null;
          return {
            clientId: crypto.randomUUID(),
            sourceSheet: area.levelCode,
            levelCode: area.levelCode,
            areaCode: area.areaCode,
            type: area.type,
            maxSeat: area.maxSeat,
            bounds: {
              x: area.areaX ?? 0,
              y: area.areaY ?? 0,
              width: area.width ?? 10,
              height: area.height ?? 10,
            },
            acceptedCandidateIds: [],
            manualSeats: (seatList?.seats ?? []).map((seat) => ({
              clientId: crypto.randomUUID(),
              rowLabel: seat.rowLabel,
              seatNumber: seat.seatNumber,
              seatX: seat.seatX ?? area.areaX ?? 0,
              seatY: seat.seatY ?? area.areaY ?? 0,
            })),
            labelingRule: defaultLabelingRule(),
          };
        }),
      );

      const fallbackLevel = areas[0]?.levelCode ?? '1F';
      const layoutElements: DraftLayoutElement[] = detail.layoutElements.map((element) => {
        const level = typeof element.levelCode === 'string' ? element.levelCode : fallbackLevel;
        return {
          clientId: crypto.randomUUID(),
          sourceSheet: level,
          levelCode: level,
          type: typeof element.type === 'string' ? element.type : 'PILLAR',
          label: typeof element.label === 'string' ? element.label : '',
          x: Number(element.x) || 0,
          y: Number(element.y) || 0,
          width: Number(element.width) || 10,
          height: Number(element.height) || 10,
        };
      });

      editor.startFromExistingLayout({
        suggestedName: `${detail.name} 수정본`,
        layoutWidth: detail.layoutWidth,
        layoutHeight: detail.layoutHeight,
        areas,
        layoutElements,
      });
      editor.goToStep(3);
    },
  });

  const copyLayout = useMutation({
    retry: false,
    mutationFn: ({ layoutId, name }: { layoutId: number; name: string }) =>
      stadiumApi.copyLayout(layoutId, name),
    onSuccess: () => {
      if (editor.stadiumId !== null) {
        void queryClient.invalidateQueries({ queryKey: stadiumKeys.layouts(editor.stadiumId) });
      }
      editor.goToStep(4);
    },
  });

  const analyzeExcel = useMutation({
    retry: false,
    mutationFn: async (file: File) => {
      if (editor.stadiumId === null) throw new Error('공연장을 먼저 등록해 주세요.');
      return stadiumApi.analyzeExcel(editor.stadiumId, file);
    },
    onSuccess: (analysis) => {
      editor.setAnalysis(analysis);
      editor.goToStep(3);
    },
  });

  const validationIssues = useMemo(
    () => validateLayoutDraft(
      editor.areas,
      editor.layoutElements,
      editor.analysis,
      editor.layoutWidth,
      editor.layoutHeight,
    ),
    [
      editor.analysis,
      editor.areas,
      editor.layoutElements,
      editor.layoutHeight,
      editor.layoutWidth,
    ],
  );

  const focusValidationIssue = (issue: (typeof validationIssues)[number]) => {
    editor.goToStep(3);
    if (issue.sourceSheet) editor.setSelectedSheet(issue.sourceSheet);
    if (issue.areaId) editor.selectArea(issue.areaId);
    else if (issue.elementId) editor.selectElement(issue.elementId);
  };

  const confirmLayout = useMutation({
    retry: false,
    mutationFn: async () => {
      if (editor.stadiumId === null) {
        throw new Error('공연장을 먼저 등록해 주세요.');
      }
      if (!editor.layoutName.trim()) throw new Error('배치 이름을 입력해 주세요.');
      const validationError = validationIssues[0];
      if (validationError) throw new Error(validationError.message);

      const payload: StadiumLayoutCreatePayload = {
        analysisId: editor.analysis?.analysisId,
        name: editor.layoutName.trim(),
        isDefault: editor.isDefault,
        sourceSheet: editor.selectedSheet ?? editor.analysis?.sheets[0]?.name,
        layoutWidth: editor.layoutWidth,
        layoutHeight: editor.layoutHeight,
        areas: editor.areas.map(toLayoutImportAreaPayload),
        layoutElements: editor.layoutElements.map(toLayoutElementPayload),
      };
      return stadiumApi.createLayout(editor.stadiumId, payload);
    },
    onSuccess: (result) => {
      if (editor.stadiumId !== null) {
        void queryClient.invalidateQueries({ queryKey: stadiumKeys.layouts(editor.stadiumId) });
      }
      editor.goToStep(4);
      return result;
    },
  });

  const candidatesForSheet = useMemo(() => {
    if (!editor.analysis || !editor.selectedSheet) return { seats: [], elements: [] };
    return {
      seats: editor.analysis.seatCandidates.filter((candidate) => candidate.sheet === editor.selectedSheet),
      elements: editor.analysis.elementCandidates.filter(
        (candidate) => candidate.sheet === editor.selectedSheet,
      ),
    };
  }, [editor.analysis, editor.selectedSheet]);

  const automaticSeatCandidateIdsForSheet = useMemo(
    () => detectAutomaticSeatCandidateIds(candidatesForSheet.seats),
    [candidatesForSheet.seats],
  );

  const ownerByCandidateId = useMemo(() => {
    const map = new Map<string, string>();
    for (const area of editor.areas) {
      for (const candidateId of area.acceptedCandidateIds) map.set(candidateId, area.clientId);
    }
    return map;
  }, [editor.areas]);

  const areasForSheet = useMemo(
    () => editor.areas.filter((area) => area.sourceSheet === editor.selectedSheet),
    [editor.areas, editor.selectedSheet],
  );

  const layoutElementsForSheet = useMemo(
    () => editor.layoutElements.filter((element) => element.sourceSheet === editor.selectedSheet),
    [editor.layoutElements, editor.selectedSheet],
  );

  const selectedArea = useMemo(
    () => editor.areas.find((area) => area.clientId === editor.selectedAreaId) ?? null,
    [editor.areas, editor.selectedAreaId],
  );

  const selectedElement = useMemo(
    () => editor.layoutElements.find((element) => element.clientId === editor.selectedElementId) ?? null,
    [editor.layoutElements, editor.selectedElementId],
  );

  const reset = () => {
    editor.reset();
    createStadium.reset();
    startFromLayout.reset();
    copyLayout.reset();
    analyzeExcel.reset();
    confirmLayout.reset();
  };

  return {
    ...editor,
    candidatesForSheet,
    automaticSeatCandidateIdsForSheet,
    ownerByCandidateId,
    stadiums,
    layouts,
    areasForSheet,
    layoutElementsForSheet,
    selectedArea,
    selectedElement,
    createStadium,
    startFromLayout,
    copyLayout,
    analyzeExcel,
    confirmLayout,
    validationIssues,
    focusValidationIssue,
    reset,
  };
}

export type StadiumEditorController = ReturnType<typeof useStadiumEditor>;
