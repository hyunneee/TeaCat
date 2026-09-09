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
  StadiumEditorDraftData,
  StadiumInfoDraft,
  StadiumLayoutEditorTool,
} from '../model/stadium.types';

interface StadiumEditorState {
  step: number;
  info: StadiumInfoDraft;
  stadiumId: number | null;

  analysis: ExcelAnalysis | null;
  analysisExpiresAt: number | null;
  selectedSheet: string | null;
  layoutName: string;
  isDefault: boolean;
  layoutWidth: number;
  layoutHeight: number;

  tool: StadiumLayoutEditorTool;
  areas: DraftArea[];
  unassignedSeats: DraftManualSeat[];
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
  restoreDraft: (draft: StadiumEditorDraftData) => void;
  setSelectedSheet: (sheet: string) => void;
  setLayoutName: (name: string) => void;
  setIsDefault: (value: boolean) => void;
  setTool: (tool: StadiumLayoutEditorTool) => void;

  addArea: (rect: LayoutRect) => void;
  selectArea: (areaId: string | null) => void;
  updateArea: (
    areaId: string,
    values: Partial<Pick<DraftArea, 'areaCode' | 'type' | 'maxSeat'>>,
  ) => void;
  updateAreaBounds: (areaId: string, bounds: LayoutRect) => void;
  autoFitAreaBounds: (areaId: string) => void;
  splitArea: (areaId: string, selection: LayoutRect) => void;
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
  assignManualSeats: (areaId: string, seatClientIds: string[]) => void;

  addElement: (rect: LayoutRect) => void;
  selectElement: (elementId: string | null) => void;
  updateElement: (
    elementId: string,
    values: Partial<Pick<DraftLayoutElement, 'type' | 'label'>>,
  ) => void;
  removeElement: (elementId: string) => void;

  reset: () => void;
}

const initial = {
  step: 0,
  info: { name: '', address: '', phone: '' } as StadiumInfoDraft,
  stadiumId: null as number | null,

  analysis: null as ExcelAnalysis | null,
  analysisExpiresAt: null as number | null,
  selectedSheet: null as string | null,
  layoutName: '기본 배치',
  isDefault: true,
  layoutWidth: 1,
  layoutHeight: 1,

  tool: 'draw-area' as StadiumLayoutEditorTool,
  areas: [] as DraftArea[],
  unassignedSeats: [] as DraftManualSeat[],
  selectedAreaId: null as string | null,
  layoutElements: [] as DraftLayoutElement[],
  selectedElementId: null as string | null,
};

function fitAreaBounds(
  area: DraftArea,
  analysis: ExcelAnalysis | null,
  layoutWidth: number,
  layoutHeight: number,
  padding = 8,
): LayoutRect | null {
  const candidateById = new Map(
    (analysis?.seatCandidates ?? []).map((candidate) => [candidate.candidateId, candidate]),
  );
  const extents = area.acceptedCandidateIds.flatMap((candidateId) => {
    const candidate = candidateById.get(candidateId);
    return candidate
      ? [
          {
            left: candidate.x,
            top: candidate.y,
            right: candidate.x + candidate.width,
            bottom: candidate.y + candidate.height,
          },
        ]
      : [];
  });
  for (const seat of area.manualSeats) {
    extents.push({
      left: seat.seatX - 4,
      top: seat.seatY - 4,
      right: seat.seatX + 4,
      bottom: seat.seatY + 4,
    });
  }
  if (extents.length === 0) return null;

  const left = Math.max(0, Math.min(...extents.map((extent) => extent.left)) - padding);
  const top = Math.max(0, Math.min(...extents.map((extent) => extent.top)) - padding);
  const right = Math.min(layoutWidth, Math.max(...extents.map((extent) => extent.right)) + padding);
  const bottom = Math.min(
    layoutHeight,
    Math.max(...extents.map((extent) => extent.bottom)) + padding,
  );
  return {
    x: roundCoordinate(left),
    y: roundCoordinate(top),
    width: roundCoordinate(Math.max(5, right - left)),
    height: roundCoordinate(Math.max(5, bottom - top)),
  };
}

function nextAvailableAreaCode(areas: DraftArea[], sourceSheet: string): string {
  const used = new Set(
    areas.filter((area) => area.sourceSheet === sourceSheet).map((area) => area.areaCode.trim()),
  );
  let index = 0;
  while (used.has(nextAreaCode(index))) index += 1;
  return nextAreaCode(index);
}

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
      analysisExpiresAt: Date.now() + analysis.expiresIn * 1000,
      selectedSheet: firstSheet,
      layoutWidth: size.width,
      layoutHeight: size.height,
      areas: [],
      unassignedSeats: [],
      selectedAreaId: null,
      layoutElements: [],
      selectedElementId: null,
      tool: 'draw-area',
    });
  },

  startFromExistingLayout: (payload) =>
    set({
      analysis: null,
      analysisExpiresAt: null,
      selectedSheet: payload.areas[0]?.levelCode ?? payload.layoutElements[0]?.levelCode ?? '1F',
      layoutName: payload.suggestedName,
      isDefault: false,
      layoutWidth: payload.layoutWidth,
      layoutHeight: payload.layoutHeight,
      areas: payload.areas,
      unassignedSeats: [],
      layoutElements: payload.layoutElements,
      selectedAreaId: null,
      selectedElementId: null,
      tool: 'draw-area',
    }),

  restoreDraft: (draft) => set({ ...draft }),

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
    set((state) => {
      const newlyUnassigned: DraftManualSeat[] = [];
      const areas = state.areas.map((area) => {
        if (area.clientId !== areaId) return area;
        const type = (values.type ?? area.type) as StadiumAreaType;
        if (area.type === 'SEATED' && type === 'STANDING') {
          newlyUnassigned.push(...area.manualSeats);
        }
        return {
          ...area,
          ...values,
          maxSeat: Math.max(1, values.maxSeat ?? area.maxSeat),
          type,
          acceptedCandidateIds: type === 'STANDING' ? [] : area.acceptedCandidateIds,
          manualSeats: type === 'STANDING' ? [] : area.manualSeats,
        };
      });
      return {
        areas,
        unassignedSeats: [...state.unassignedSeats, ...newlyUnassigned],
      };
    }),

  updateAreaBounds: (areaId, bounds) =>
    set((state) => {
      const candidateById = new Map(
        (state.analysis?.seatCandidates ?? []).map((candidate) => [
          candidate.candidateId,
          candidate,
        ]),
      );
      const releasedSeats: DraftManualSeat[] = [];
      return {
        areas: state.areas.map((area) => {
          if (area.clientId !== areaId) return area;
          const manualSeats = area.manualSeats.filter((seat) => {
            const inside = isInsideRect({ x: seat.seatX, y: seat.seatY }, bounds);
            if (!inside) releasedSeats.push(seat);
            return inside;
          });
          const acceptedCandidateIds = area.acceptedCandidateIds.filter((candidateId) => {
            const candidate = candidateById.get(candidateId);
            return !candidate || isInsideRect(candidateCenter(candidate), bounds);
          });
          return { ...area, bounds, manualSeats, acceptedCandidateIds };
        }),
        unassignedSeats: [...state.unassignedSeats, ...releasedSeats],
      };
    }),

  autoFitAreaBounds: (areaId) =>
    set((state) => ({
      areas: state.areas.map((area) => {
        if (area.clientId !== areaId) return area;
        const bounds = fitAreaBounds(area, state.analysis, state.layoutWidth, state.layoutHeight);
        return bounds ? { ...area, bounds } : area;
      }),
    })),

  splitArea: (areaId, selection) =>
    set((state) => {
      const source = state.areas.find((area) => area.clientId === areaId);
      if (!source || source.type !== 'SEATED') return state;
      const candidateById = new Map(
        (state.analysis?.seatCandidates ?? []).map((candidate) => [
          candidate.candidateId,
          candidate,
        ]),
      );
      const movedCandidateIds = source.acceptedCandidateIds.filter((candidateId) => {
        const candidate = candidateById.get(candidateId);
        return candidate ? isInsideRect(candidateCenter(candidate), selection) : false;
      });
      const movedCandidateSet = new Set(movedCandidateIds);
      const movedManualSeats = source.manualSeats.filter((seat) =>
        isInsideRect({ x: seat.seatX, y: seat.seatY }, selection),
      );
      const movedSeatCount = movedCandidateIds.length + movedManualSeats.length;
      const totalSeatCount = source.acceptedCandidateIds.length + source.manualSeats.length;
      if (movedSeatCount === 0 || movedSeatCount >= totalSeatCount) return state;
      const movedManualSeatIds = new Set(movedManualSeats.map((seat) => seat.clientId));
      const remainingArea: DraftArea = {
        ...source,
        acceptedCandidateIds: source.acceptedCandidateIds.filter(
          (candidateId) => !movedCandidateSet.has(candidateId),
        ),
        manualSeats: source.manualSeats.filter((seat) => !movedManualSeatIds.has(seat.clientId)),
      };
      const clientId = crypto.randomUUID();
      const newArea: DraftArea = {
        ...source,
        clientId,
        areaCode: nextAvailableAreaCode(state.areas, source.sourceSheet),
        acceptedCandidateIds: movedCandidateIds,
        manualSeats: movedManualSeats,
        bounds: selection,
      };
      const fittedRemaining = fitAreaBounds(
        remainingArea,
        state.analysis,
        state.layoutWidth,
        state.layoutHeight,
        2,
      );
      const fittedNew = fitAreaBounds(
        newArea,
        state.analysis,
        state.layoutWidth,
        state.layoutHeight,
        2,
      );
      return {
        areas: [
          ...state.areas.filter((area) => area.clientId !== areaId),
          { ...remainingArea, bounds: fittedRemaining ?? remainingArea.bounds },
          { ...newArea, bounds: fittedNew ?? newArea.bounds },
        ],
        selectedAreaId: clientId,
        selectedElementId: null,
        tool: 'pick-seats',
      };
    }),

  updateLabelingRule: (areaId, values) =>
    set((state) => ({
      areas: state.areas.map((area) =>
        area.clientId === areaId
          ? { ...area, labelingRule: { ...area.labelingRule, ...values } }
          : area,
      ),
    })),

  removeArea: (areaId) =>
    set((state) => {
      const removedArea = state.areas.find((area) => area.clientId === areaId);
      return {
        areas: state.areas.filter((area) => area.clientId !== areaId),
        unassignedSeats: [...state.unassignedSeats, ...(removedArea?.manualSeats ?? [])],
        selectedAreaId: state.selectedAreaId === areaId ? null : state.selectedAreaId,
      };
    }),

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
            acceptedCandidateIds: area.acceptedCandidateIds.filter(
              (id) => !candidateIds.includes(id),
            ),
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
        const has = area.acceptedCandidateIds.includes(candidateId);
        if (area.clientId !== areaId) {
          return has
            ? {
                ...area,
                acceptedCandidateIds: area.acceptedCandidateIds.filter((id) => id !== candidateId),
              }
            : area;
        }
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
        const nextNumber =
          area.manualSeats.reduce((max, seat) => Math.max(max, seat.seatNumber), 0) + 1;
        const seat: DraftManualSeat = {
          clientId: crypto.randomUUID(),
          sourceSheet: area.sourceSheet,
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
    set((state) => {
      const seat = state.areas
        .find((area) => area.clientId === areaId)
        ?.manualSeats.find((item) => item.clientId === seatClientId);
      if (!seat) return state;
      return {
        areas: state.areas.map((area) =>
          area.clientId === areaId
            ? {
                ...area,
                manualSeats: area.manualSeats.filter((item) => item.clientId !== seatClientId),
              }
            : area,
        ),
        unassignedSeats: [...state.unassignedSeats, seat],
      };
    }),

  removeManualSeats: (areaId, seatClientIds) =>
    set((state) => {
      const removing = new Set(seatClientIds);
      const releasedSeats =
        state.areas
          .find((area) => area.clientId === areaId)
          ?.manualSeats.filter((seat) => removing.has(seat.clientId)) ?? [];
      return {
        areas: state.areas.map((area) =>
          area.clientId === areaId
            ? {
                ...area,
                manualSeats: area.manualSeats.filter((seat) => !removing.has(seat.clientId)),
              }
            : area,
        ),
        unassignedSeats: [...state.unassignedSeats, ...releasedSeats],
      };
    }),

  assignManualSeats: (areaId, seatClientIds) =>
    set((state) => {
      const targetArea = state.areas.find((area) => area.clientId === areaId);
      if (!targetArea || targetArea.type !== 'SEATED') return state;
      const requested = new Set(seatClientIds);
      const movable = [...state.unassignedSeats, ...state.areas.flatMap((area) => area.manualSeats)]
        .filter((seat) => requested.has(seat.clientId))
        .filter((seat) => isInsideRect({ x: seat.seatX, y: seat.seatY }, targetArea.bounds));
      const movingIds = new Set(movable.map((seat) => seat.clientId));
      if (movingIds.size === 0) return state;
      return {
        unassignedSeats: state.unassignedSeats.filter((seat) => !movingIds.has(seat.clientId)),
        areas: state.areas.map((area) => ({
          ...area,
          manualSeats:
            area.clientId === areaId
              ? [...area.manualSeats.filter((seat) => !movingIds.has(seat.clientId)), ...movable]
              : area.manualSeats.filter((seat) => !movingIds.has(seat.clientId)),
        })),
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
