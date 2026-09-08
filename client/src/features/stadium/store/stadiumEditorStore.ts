import { create } from 'zustand';
import {
  candidateCenter,
  computeLayoutSize,
  defaultLabelingRule,
  detectAutomaticSeatCandidateIds,
  isInsideRect,
  nextAreaCode,
  roundCoordinate,
} from '../model/stadium.model';
import type {
  DraftArea,
  DraftLabelingRule,
  DraftLayoutElement,
  DraftManualSeat,
  ExcelAnalysis,
  LayoutRect,
  StadiumAreaType,
  StadiumInfoDraft,
  StadiumLayoutEditorTool,
} from '../model/stadium.types';

interface StadiumEditorState {
  step: number;
  info: StadiumInfoDraft;
  stadiumId: number | null;

  analysis: ExcelAnalysis | null;
  selectedSheet: string | null;
  layoutName: string;
  isDefault: boolean;
  layoutWidth: number;
  layoutHeight: number;

  tool: StadiumLayoutEditorTool;
  areas: DraftArea[];
  selectedAreaId: string | null;
  layoutElements: DraftLayoutElement[];
  selectedElementId: string | null;

  goToStep: (step: number) => void;
  setInfo: (field: keyof StadiumInfoDraft, value: string) => void;
  setStadiumId: (stadiumId: number) => void;
  startLayoutForStadium: (stadiumId: number) => void;
  setAnalysis: (analysis: ExcelAnalysis) => void;
  startFromExistingLayout: (payload: {
    suggestedName: string;
    layoutWidth: number;
    layoutHeight: number;
    areas: DraftArea[];
    layoutElements: DraftLayoutElement[];
  }) => void;
  setSelectedSheet: (sheet: string) => void;
  setLayoutName: (name: string) => void;
  setIsDefault: (value: boolean) => void;
  setTool: (tool: StadiumLayoutEditorTool) => void;

  addArea: (rect: LayoutRect) => void;
  selectArea: (areaId: string | null) => void;
  updateArea: (areaId: string, values: Partial<Pick<DraftArea, 'areaCode' | 'type' | 'maxSeat'>>) => void;
  updateLabelingRule: (areaId: string, values: Partial<DraftLabelingRule>) => void;
  removeArea: (areaId: string) => void;

  acceptCandidates: (areaId: string, candidateIds: string[]) => void;
  removeCandidates: (areaId: string, candidateIds: string[]) => void;
  toggleCandidate: (areaId: string, candidateId: string) => void;
  addManualSeat: (areaId: string, x: number, y: number) => void;
  updateManualSeat: (
    areaId: string,
    seatClientId: string,
    values: Partial<Pick<DraftManualSeat, 'rowLabel' | 'seatNumber'>>,
  ) => void;
  removeManualSeat: (areaId: string, seatClientId: string) => void;
  removeManualSeats: (areaId: string, seatClientIds: string[]) => void;

  addElement: (rect: LayoutRect) => void;
  selectElement: (elementId: string | null) => void;
  updateElement: (elementId: string, values: Partial<Pick<DraftLayoutElement, 'type' | 'label'>>) => void;
  removeElement: (elementId: string) => void;

  reset: () => void;
}

const initial = {
  step: 0,
  info: { name: '', address: '', phone: '' } as StadiumInfoDraft,
  stadiumId: null as number | null,

  analysis: null as ExcelAnalysis | null,
  selectedSheet: null as string | null,
  layoutName: '기본 배치',
  isDefault: true,
  layoutWidth: 1,
  layoutHeight: 1,

  tool: 'draw-area' as StadiumLayoutEditorTool,
  areas: [] as DraftArea[],
  selectedAreaId: null as string | null,
  layoutElements: [] as DraftLayoutElement[],
  selectedElementId: null as string | null,
};

export const useStadiumEditorStore = create<StadiumEditorState>((set) => ({
  ...initial,

  goToStep: (step) => set({ step }),
  setInfo: (field, value) => set((state) => ({ info: { ...state.info, [field]: value } })),
  setStadiumId: (stadiumId) => set({ stadiumId }),
  startLayoutForStadium: (stadiumId) =>
    set({ ...initial, stadiumId, step: 1, layoutName: '새 배치', isDefault: false }),

  setAnalysis: (analysis) => {
    const firstSheet = analysis.sheets[0]?.name ?? null;
    const size = computeLayoutSize([...analysis.seatCandidates, ...analysis.elementCandidates]);
    set({
      analysis,
      selectedSheet: firstSheet,
      layoutWidth: size.width,
      layoutHeight: size.height,
      areas: [],
      selectedAreaId: null,
      layoutElements: [],
      selectedElementId: null,
      tool: 'draw-area',
    });
  },

  startFromExistingLayout: (payload) =>
    set({
      analysis: null,
      selectedSheet: payload.areas[0]?.levelCode ?? payload.layoutElements[0]?.levelCode ?? '1F',
      layoutName: payload.suggestedName,
      isDefault: false,
      layoutWidth: payload.layoutWidth,
      layoutHeight: payload.layoutHeight,
      areas: payload.areas,
      layoutElements: payload.layoutElements,
      selectedAreaId: null,
      selectedElementId: null,
      tool: 'draw-area',
    }),

  setSelectedSheet: (selectedSheet) =>
    set({
      selectedSheet,
      selectedAreaId: null,
      selectedElementId: null,
      tool: 'draw-area',
    }),

  setLayoutName: (layoutName) => set({ layoutName }),
  setIsDefault: (isDefault) => set({ isDefault }),
  setTool: (tool) => set({ tool }),

  addArea: (rect) =>
    set((state) => {
      const clientId = crypto.randomUUID();
      const alreadyAssigned = new Set(
        state.areas.flatMap((existingArea) => existingArea.acceptedCandidateIds),
      );
      const sheetCandidates = (state.analysis?.seatCandidates ?? []).filter(
        (candidate) => candidate.sheet === state.selectedSheet,
      );
      const automaticallyDetected = detectAutomaticSeatCandidateIds(sheetCandidates);
      const acceptedCandidateIds = sheetCandidates
        .filter(
          (candidate) =>
            automaticallyDetected.has(candidate.candidateId) &&
            !alreadyAssigned.has(candidate.candidateId) &&
            isInsideRect(candidateCenter(candidate), rect),
        )
        .map((candidate) => candidate.candidateId);
      const area: DraftArea = {
        clientId,
        sourceSheet: state.selectedSheet ?? '1F',
        levelCode: state.selectedSheet ?? '1F',
        areaCode: nextAreaCode(
          state.areas.filter((area) => area.sourceSheet === state.selectedSheet).length,
        ),
        type: 'SEATED',
        maxSeat: 1,
        bounds: rect,
        acceptedCandidateIds,
        manualSeats: [],
        labelingRule: defaultLabelingRule(),
      };
      return {
        areas: [...state.areas, area],
        selectedAreaId: clientId,
        tool: 'pick-seats',
      };
    }),

  selectArea: (selectedAreaId) => set({ selectedAreaId, selectedElementId: null }),

  updateArea: (areaId, values) =>
    set((state) => ({
      areas: state.areas.map((area) => {
        if (area.clientId !== areaId) return area;
        const type = (values.type ?? area.type) as StadiumAreaType;
        return {
          ...area,
          ...values,
          maxSeat: Math.max(1, values.maxSeat ?? area.maxSeat),
          type,
          acceptedCandidateIds: type === 'STANDING' ? [] : area.acceptedCandidateIds,
          manualSeats: type === 'STANDING' ? [] : area.manualSeats,
        };
      }),
    })),

  updateLabelingRule: (areaId, values) =>
    set((state) => ({
      areas: state.areas.map((area) =>
        area.clientId === areaId
          ? { ...area, labelingRule: { ...area.labelingRule, ...values } }
          : area,
      ),
    })),

  removeArea: (areaId) =>
    set((state) => ({
      areas: state.areas.filter((area) => area.clientId !== areaId),
      selectedAreaId: state.selectedAreaId === areaId ? null : state.selectedAreaId,
    })),

  acceptCandidates: (areaId, candidateIds) =>
    set((state) => ({
      areas: state.areas.map((area) => {
        if (area.clientId === areaId) {
          const merged = new Set([...area.acceptedCandidateIds, ...candidateIds]);
          return { ...area, acceptedCandidateIds: [...merged] };
        }
        if (candidateIds.some((id) => area.acceptedCandidateIds.includes(id))) {
          return {
            ...area,
            acceptedCandidateIds: area.acceptedCandidateIds.filter((id) => !candidateIds.includes(id)),
          };
        }
        return area;
      }),
    })),

  removeCandidates: (areaId, candidateIds) =>
    set((state) => {
      const removing = new Set(candidateIds);
      return {
        areas: state.areas.map((area) =>
          area.clientId === areaId
            ? {
                ...area,
                acceptedCandidateIds: area.acceptedCandidateIds.filter(
                  (candidateId) => !removing.has(candidateId),
                ),
              }
            : area,
        ),
      };
    }),

  toggleCandidate: (areaId, candidateId) =>
    set((state) => ({
      areas: state.areas.map((area) => {
        if (area.clientId !== areaId) return area;
        const has = area.acceptedCandidateIds.includes(candidateId);
        return {
          ...area,
          acceptedCandidateIds: has
            ? area.acceptedCandidateIds.filter((id) => id !== candidateId)
            : [...area.acceptedCandidateIds, candidateId],
        };
      }),
    })),

  addManualSeat: (areaId, x, y) =>
    set((state) => ({
      areas: state.areas.map((area) => {
        if (area.clientId !== areaId || area.type !== 'SEATED') return area;
        const nextNumber = area.manualSeats.reduce((max, seat) => Math.max(max, seat.seatNumber), 0) + 1;
        const seat: DraftManualSeat = {
          clientId: crypto.randomUUID(),
          rowLabel: '수동',
          seatNumber: nextNumber,
          seatX: roundCoordinate(x),
          seatY: roundCoordinate(y),
        };
        return { ...area, manualSeats: [...area.manualSeats, seat] };
      }),
    })),

  updateManualSeat: (areaId, seatClientId, values) =>
    set((state) => ({
      areas: state.areas.map((area) =>
        area.clientId === areaId
          ? {
              ...area,
              manualSeats: area.manualSeats.map((seat) =>
                seat.clientId === seatClientId
                  ? {
                      ...seat,
                      ...values,
                      rowLabel: values.rowLabel ?? seat.rowLabel,
                      seatNumber: Math.max(1, values.seatNumber ?? seat.seatNumber),
                    }
                  : seat,
              ),
            }
          : area,
      ),
    })),

  removeManualSeat: (areaId, seatClientId) =>
    set((state) => ({
      areas: state.areas.map((area) =>
        area.clientId === areaId
          ? { ...area, manualSeats: area.manualSeats.filter((seat) => seat.clientId !== seatClientId) }
          : area,
      ),
    })),

  removeManualSeats: (areaId, seatClientIds) =>
    set((state) => {
      const removing = new Set(seatClientIds);
      return {
        areas: state.areas.map((area) =>
          area.clientId === areaId
            ? {
                ...area,
                manualSeats: area.manualSeats.filter((seat) => !removing.has(seat.clientId)),
              }
            : area,
        ),
      };
    }),

  addElement: (rect) =>
    set((state) => {
      const clientId = crypto.randomUUID();
      const element: DraftLayoutElement = {
        clientId,
        sourceSheet: state.selectedSheet ?? '1F',
        levelCode: state.selectedSheet ?? '1F',
        type: 'PILLAR',
        label: `요소-${state.layoutElements.length + 1}`,
        ...rect,
      };
      return {
        layoutElements: [...state.layoutElements, element],
        selectedElementId: clientId,
        selectedAreaId: null,
      };
    }),

  selectElement: (selectedElementId) => set({ selectedElementId, selectedAreaId: null }),

  updateElement: (elementId, values) =>
    set((state) => ({
      layoutElements: state.layoutElements.map((element) =>
        element.clientId === elementId ? { ...element, ...values } : element,
      ),
    })),

  removeElement: (elementId) =>
    set((state) => ({
      layoutElements: state.layoutElements.filter((element) => element.clientId !== elementId),
      selectedElementId: state.selectedElementId === elementId ? null : state.selectedElementId,
    })),

  reset: () => set(initial),
}));
