import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { cn } from '@/shared/lib';
import {
  buildSeatLabelPreview,
  candidateCenter,
  computeSeatPitch,
  findCandidateAtPoint,
  inferManualSeatRects,
  isInsideRect,
  normalizeRect,
} from '../model/stadium.model';
import type {
  DraftArea,
  DraftLayoutElement,
  DraftManualSeat,
  ExcelCandidate,
  LayoutPoint,
  LayoutRect,
  StadiumLayoutEditorTool,
} from '../model/stadium.types';

interface StadiumLayoutCanvasProps {
  layoutWidth: number;
  layoutHeight: number;
  seatCandidates: ExcelCandidate[];
  elementCandidates: ExcelCandidate[];
  areas: DraftArea[];
  unassignedSeats?: DraftManualSeat[];
  invalidAreaIds?: Set<string>;
  layoutElements: DraftLayoutElement[];
  selectedAreaId: string | null;
  selectedElementId: string | null;
  tool: StadiumLayoutEditorTool;
  ownerByCandidateId: Map<string, string>;
  automaticSeatCandidateIds: Set<string>;
  onAddArea: (rect: LayoutRect) => void;
  onUpdateAreaBounds: (areaId: string, rect: LayoutRect) => void;
  onSplitArea: (areaId: string, rect: LayoutRect) => void;
  onSelectArea: (areaId: string | null) => void;
  onToggleCandidate: (areaId: string, candidateId: string) => void;
  onRemoveManualSeats: (areaId: string, seatClientIds: string[]) => void;
  onAssignManualSeats: (areaId: string, seatClientIds: string[]) => void;
  onBulkCandidateChange: (areaId: string, rect: LayoutRect, operation: 'ADD' | 'REMOVE') => void;
  onAddElement: (rect: LayoutRect) => void;
  onSelectElement: (elementId: string | null) => void;
  className?: string;
}

const MAX_RENDER_WIDTH = 1200;
const EMPTY_IDS = new Set<string>();

type Interaction =
  | { mode: 'draw-area'; start: LayoutPoint }
  | { mode: 'resize-area'; start: LayoutPoint; areaId: string }
  | { mode: 'split-area'; start: LayoutPoint; areaId: string }
  | { mode: 'draw-element'; start: LayoutPoint }
  | { mode: 'seat-range'; start: LayoutPoint; areaId: string; operation: 'ADD' | 'REMOVE' }
  | null;

export function StadiumLayoutCanvas({
  layoutWidth,
  layoutHeight,
  seatCandidates,
  elementCandidates,
  areas,
  unassignedSeats = [],
  invalidAreaIds = EMPTY_IDS,
  layoutElements,
  selectedAreaId,
  selectedElementId,
  tool,
  ownerByCandidateId,
  automaticSeatCandidateIds,
  onAddArea,
  onUpdateAreaBounds,
  onSplitArea,
  onSelectArea,
  onToggleCandidate,
  onRemoveManualSeats,
  onAssignManualSeats,
  onBulkCandidateChange,
  onAddElement,
  onSelectElement,
  className,
}: StadiumLayoutCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactionRef = useRef<Interaction>(null);
  const [drawingRect, setDrawingRect] = useState<LayoutRect | null>(null);
  const [zoom, setZoom] = useState(1);

  const baseScale = useMemo(
    () => Math.min(1, MAX_RENDER_WIDTH / Math.max(1, layoutWidth)),
    [layoutWidth],
  );
  const scale = baseScale * zoom;
  const renderWidth = Math.max(1, Math.round(layoutWidth * scale));
  const renderHeight = Math.max(1, Math.round(layoutHeight * scale));
  const selectedSeatLabels = useMemo(() => {
    const selectedArea = areas.find((area) => area.clientId === selectedAreaId);
    if (!selectedArea) return new Map<string, string>();
    return new Map(
      buildSeatLabelPreview(selectedArea, seatCandidates).map((seat) => [
        seat.candidateId,
        seat.label,
      ]),
    );
  }, [areas, seatCandidates, selectedAreaId]);
  const seatPitch = useMemo(
    () => computeSeatPitch(areas, unassignedSeats),
    [areas, unassignedSeats],
  );
  const manualSeatRects = useMemo(() => {
    const result = new Map<string, LayoutRect>();
    for (const area of areas) {
      for (const [seatId, rect] of inferManualSeatRects(area, seatPitch)) result.set(seatId, rect);
    }
    for (const [seatId, rect] of inferManualSeatRects(
      { manualSeats: unassignedSeats },
      seatPitch,
    )) {
      result.set(seatId, rect);
    }
    return result;
  }, [areas, seatPitch, unassignedSeats]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = renderWidth;
    canvas.height = renderHeight;
    const context = canvas.getContext('2d');
    if (!context) return;

    const styles = getComputedStyle(canvas);
    const ink = styles.getPropertyValue('--color-brand-900').trim() || '#222';
    const inkMuted = styles.getPropertyValue('--color-ink-subtle').trim() || '#888';
    const accent = styles.getPropertyValue('--color-accent-700').trim() || '#3d5335';
    const danger = styles.getPropertyValue('--color-danger').trim() || '#b42318';
    const surface = styles.getPropertyValue('--color-surface-1').trim() || '#fff';

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = surface;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // 저장 가능한 Excel 원본 가이드. 편집 요소와 달리 항상 가장 아래에
    // 옅은 중성색으로 그려 좌석·구역 상태보다 먼저 눈에 띄지 않게 한다.
    // Excel에서 감지된 참조 요소(무대·기둥 등 텍스트 후보)
    context.save();
    context.setLineDash([4, 3]);
    context.strokeStyle = inkMuted;
    context.fillStyle = inkMuted;
    context.font = '500 11px sans-serif';
    for (const candidate of elementCandidates) {
      traceCandidateShape(context, candidate, scale);
      context.stroke();
      if (candidate.rawText) {
        context.fillText(candidate.rawText, candidate.x * scale + 3, candidate.y * scale + 12);
      }
    }
    context.restore();

    // 구역
    for (const area of areas) {
      const selected = area.clientId === selectedAreaId;
      const invalid = invalidAreaIds.has(area.clientId);
      context.save();
      context.strokeStyle = invalid ? danger : selected ? accent : ink;
      context.lineWidth = invalid || selected ? 3 : 1.5;
      context.globalAlpha = selected ? 0.14 : 0.06;
      context.fillStyle = invalid ? danger : selected ? accent : ink;
      const b = area.bounds;
      context.fillRect(b.x * scale, b.y * scale, b.width * scale, b.height * scale);
      context.globalAlpha = 1;
      context.strokeRect(b.x * scale, b.y * scale, b.width * scale, b.height * scale);

      context.font = '600 13px sans-serif';
      const label = `${area.areaCode} (${area.type === 'STANDING' ? area.maxSeat : area.acceptedCandidateIds.length + area.manualSeats.length})`;
      const labelWidth = context.measureText(label).width + 12;
      context.fillStyle = surface;
      context.fillRect(b.x * scale, b.y * scale, labelWidth, 20);
      context.fillStyle = invalid ? danger : ink;
      context.fillText(label, b.x * scale + 6, b.y * scale + 14);
      context.restore();
    }

    // 좌석 후보
    for (const candidate of seatCandidates) {
      const owner = ownerByCandidateId.get(candidate.candidateId);
      traceCandidateShape(context, candidate, scale);
      if (owner && owner === selectedAreaId) {
        context.fillStyle = accent;
        context.globalAlpha = 0.72;
        context.fill();
        context.globalAlpha = 1;
        context.strokeStyle = accent;
        context.lineWidth = 1.5;
        context.stroke();
      } else if (owner) {
        context.fillStyle = inkMuted;
        context.globalAlpha = 0.42;
        context.fill();
        context.globalAlpha = 1;
      } else {
        const automaticallyDetected = automaticSeatCandidateIds.has(candidate.candidateId);
        context.strokeStyle = automaticallyDetected ? ink : inkMuted;
        context.globalAlpha = automaticallyDetected ? 1 : 0.28;
        context.lineWidth = 1;
        context.stroke();
        context.globalAlpha = 1;
      }

      const label = selectedSeatLabels.get(candidate.candidateId) ?? candidate.rawText;
      if (label && candidate.width * scale >= 16 && candidate.height * scale >= 10) {
        const center = candidateCenter(candidate);
        context.font = `${Math.max(8, Math.min(11, candidate.height * scale * 0.45))}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = owner && owner === selectedAreaId ? surface : ink;
        context.fillText(label, center.x * scale, center.y * scale);
        context.textAlign = 'start';
        context.textBaseline = 'alphabetic';
      }
    }

    // 고정 요소
    for (const element of layoutElements) {
      const selected = element.clientId === selectedElementId;
      context.save();
      context.fillStyle = '#c17a2b';
      context.globalAlpha = selected ? 0.35 : 0.2;
      context.fillRect(
        element.x * scale,
        element.y * scale,
        element.width * scale,
        element.height * scale,
      );
      context.globalAlpha = 1;
      context.strokeStyle = '#c17a2b';
      context.lineWidth = selected ? 2.5 : 1.5;
      context.strokeRect(
        element.x * scale,
        element.y * scale,
        element.width * scale,
        element.height * scale,
      );
      context.font = '600 11px sans-serif';
      context.fillStyle = '#7a4a15';
      context.fillText(element.label, element.x * scale + 3, element.y * scale + 12);
      context.restore();
    }

    // 기존 배치에서 불러온 좌석(공유 좌석 피치로 같은 크기 사각형에 배치).
    // Excel 후보가 없는 편집 진입에서는 이게 유일한 좌석이라, 선택하지 않아도
    // 또렷하게 그리고 라벨을 붙인다. (그렇지 않으면 라벨 없는 회색 덩어리로만 보인다)
    const editMode = seatCandidates.length === 0;
    for (const area of areas) {
      for (const seat of area.manualSeats) {
        const rect = manualSeatRects.get(seat.clientId);
        if (!rect) continue;
        const selected = area.clientId === selectedAreaId;
        const showLabel = selected || editMode;
        context.fillStyle = selected ? accent : inkMuted;
        context.globalAlpha = selected ? 0.58 : editMode ? 0.32 : 0.18;
        context.fillRect(rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale);
        context.globalAlpha = 1;
        context.strokeStyle = selected ? accent : inkMuted;
        context.lineWidth = selected ? 1.5 : 1;
        context.strokeRect(rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale);
        if (showLabel && rect.width * scale >= 15 && rect.height * scale >= 10) {
          context.font = `${Math.max(8, Math.min(10, rect.height * scale * 0.42))}px sans-serif`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillStyle = selected ? surface : ink;
          context.fillText(
            `${seat.rowLabel}-${seat.seatNumber}`,
            seat.seatX * scale,
            seat.seatY * scale,
          );
          context.textAlign = 'start';
          context.textBaseline = 'alphabetic';
        }
      }
    }

    for (const seat of unassignedSeats) {
      const rect = manualSeatRects.get(seat.clientId);
      if (!rect) continue;
      context.save();
      context.setLineDash([3, 2]);
      context.fillStyle = inkMuted;
      context.globalAlpha = 0.08;
      context.fillRect(rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale);
      context.globalAlpha = 0.65;
      context.strokeStyle = inkMuted;
      context.lineWidth = 1;
      context.strokeRect(rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale);
      context.restore();
    }

    if (drawingRect) {
      context.save();
      context.strokeStyle = accent;
      context.lineWidth = 2;
      context.setLineDash([8, 5]);
      context.strokeRect(
        drawingRect.x * scale,
        drawingRect.y * scale,
        drawingRect.width * scale,
        drawingRect.height * scale,
      );
      context.restore();
    }
  }, [
    areas,
    automaticSeatCandidateIds,
    drawingRect,
    elementCandidates,
    layoutElements,
    invalidAreaIds,
    manualSeatRects,
    ownerByCandidateId,
    renderHeight,
    renderWidth,
    scale,
    seatCandidates,
    selectedAreaId,
    selectedElementId,
    selectedSeatLabels,
    unassignedSeats,
  ]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      const point = getEventPoint(canvasRef.current, event, scale);
      if (!point) return;
      setDrawingRect(normalizeRect(interaction.start.x, interaction.start.y, point.x, point.y));
    };
    const handleUp = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      const point = getEventPoint(canvasRef.current, event, scale);
      if (point) {
        const rect = normalizeRect(interaction.start.x, interaction.start.y, point.x, point.y);
        if (rect.width >= 5 && rect.height >= 5) {
          if (interaction.mode === 'draw-area') onAddArea(rect);
          else if (interaction.mode === 'resize-area') {
            onUpdateAreaBounds(interaction.areaId, rect);
          } else if (interaction.mode === 'split-area') {
            onSplitArea(interaction.areaId, rect);
          } else if (interaction.mode === 'draw-element') onAddElement(rect);
          else onBulkCandidateChange(interaction.areaId, rect, interaction.operation);
        }
      }
      interactionRef.current = null;
      setDrawingRect(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [onAddArea, onAddElement, onBulkCandidateChange, onSplitArea, onUpdateAreaBounds, scale]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = getEventPoint(canvasRef.current, event.nativeEvent, scale);
    if (!point) return;

    if (tool === 'draw-area' || tool === 'draw-element') {
      interactionRef.current = { mode: tool, start: point };
      setDrawingRect({ x: point.x, y: point.y, width: 0, height: 0 });
      return;
    }

    if (tool === 'resize-area' || tool === 'split-area') {
      if (!selectedAreaId) return;
      interactionRef.current = { mode: tool, start: point, areaId: selectedAreaId };
      setDrawingRect({ x: point.x, y: point.y, width: 0, height: 0 });
      return;
    }

    if (tool === 'add-seat-range' || tool === 'remove-seat-range') {
      if (!selectedAreaId) return;
      interactionRef.current = {
        mode: 'seat-range',
        start: point,
        areaId: selectedAreaId,
        operation: tool === 'add-seat-range' ? 'ADD' : 'REMOVE',
      };
      setDrawingRect({ x: point.x, y: point.y, width: 0, height: 0 });
      return;
    }

    // tool === 'pick-seats'
    const candidate = findCandidateAtPoint(seatCandidates, point, 0);
    if (candidate) {
      const owner = ownerByCandidateId.get(candidate.candidateId);
      if (!selectedAreaId) {
        if (owner) onSelectArea(owner);
        return;
      }
      const area = areas.find((item) => item.clientId === selectedAreaId);
      if (area && area.type === 'SEATED' && isInsideRect(candidateCenter(candidate), area.bounds)) {
        onToggleCandidate(area.clientId, candidate.candidateId);
      } else if (owner) {
        onSelectArea(owner);
      }
      return;
    }

    const manualSeatHit = [
      ...areas.flatMap((area) => area.manualSeats.map((seat) => ({ area, seat }))),
      ...unassignedSeats.map((seat) => ({ area: null, seat })),
    ].filter((item) => {
      const rect = manualSeatRects.get(item.seat.clientId);
      return rect ? isInsideRect(point, rect) : false;
    })[0];
    if (manualSeatHit) {
      if (manualSeatHit.area?.clientId === selectedAreaId) {
        onRemoveManualSeats(manualSeatHit.area.clientId, [manualSeatHit.seat.clientId]);
      } else if (selectedAreaId) {
        const targetArea = areas.find((area) => area.clientId === selectedAreaId);
        if (
          targetArea?.type === 'SEATED' &&
          isInsideRect(
            { x: manualSeatHit.seat.seatX, y: manualSeatHit.seat.seatY },
            targetArea.bounds,
          )
        ) {
          onAssignManualSeats(selectedAreaId, [manualSeatHit.seat.clientId]);
        } else if (manualSeatHit.area) {
          onSelectArea(manualSeatHit.area.clientId);
        }
      } else if (manualSeatHit.area) {
        onSelectArea(manualSeatHit.area.clientId);
      }
      return;
    }

    const elementHit = [...layoutElements]
      .reverse()
      .find((element) => isInsideRect(point, element));
    if (elementHit) {
      onSelectElement(elementHit.clientId);
      return;
    }

    const selectedArea = areas.find((area) => area.clientId === selectedAreaId);
    const areaHit =
      selectedArea && isInsideRect(point, selectedArea.bounds)
        ? selectedArea
        : [...areas].reverse().find((area) => isInsideRect(point, area.bounds));
    onSelectArea(areaHit?.clientId ?? null);
  };

  return (
    <div className={cn('surface-sunken w-full min-w-0 overflow-hidden rounded-2xl p-3', className)}>
      <div className="mb-2 flex items-center justify-end gap-2">
        <button
          type="button"
          aria-label="축소"
          onClick={() => setZoom((value) => Math.max(0.25, value - 0.25))}
          className="surface size-8 rounded-lg text-lg shadow-sm"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="surface min-w-16 rounded-lg px-2 py-1 text-xs shadow-sm"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          aria-label="확대"
          onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
          className="surface size-8 rounded-lg text-lg shadow-sm"
        >
          +
        </button>
      </div>
      <div className="max-h-[70vh] w-full max-w-full overflow-auto overscroll-contain rounded-xl">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          aria-label="공연장 배치 편집 캔버스"
          onPointerDown={handlePointerDown}
          style={{ width: renderWidth, height: renderHeight }}
          className={cn(
            'surface no-select shadow-card block max-w-none touch-none rounded-xl',
            (tool === 'draw-area' ||
              tool === 'draw-element' ||
              tool === 'resize-area' ||
              tool === 'split-area' ||
              tool === 'add-seat-range' ||
              tool === 'remove-seat-range') &&
              'cursor-crosshair',
            tool === 'pick-seats' && 'cursor-pointer',
          )}
        />
      </div>
    </div>
  );
}

function traceCandidateShape(
  context: CanvasRenderingContext2D,
  candidate: ExcelCandidate,
  scale: number,
) {
  traceLayoutShape(
    context,
    candidate.x,
    candidate.y,
    candidate.width,
    candidate.height,
    candidate.shapeType,
    scale,
  );
}

function traceLayoutShape(
  context: CanvasRenderingContext2D,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  shapeType: string,
  scale: number,
) {
  const x = sourceX * scale;
  const y = sourceY * scale;
  const width = Math.max(1, sourceWidth * scale);
  const height = Math.max(1, sourceHeight * scale);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const type = shapeType.toUpperCase();

  context.beginPath();
  if (type === 'ELLIPSE' || type === 'CIRCLE') {
    context.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, Math.PI * 2);
    return;
  }
  if (type === 'DIAMOND') {
    context.moveTo(centerX, y);
    context.lineTo(x + width, centerY);
    context.lineTo(centerX, y + height);
    context.lineTo(x, centerY);
    context.closePath();
    return;
  }
  if (type === 'TRIANGLE' || type === 'RIGHT_TRIANGLE') {
    context.moveTo(type === 'TRIANGLE' ? centerX : x, y);
    context.lineTo(x + width, y + height);
    context.lineTo(x, y + height);
    context.closePath();
    return;
  }
  const polygonSides: Record<string, number> = {
    PENTAGON: 5,
    HEXAGON: 6,
    HEPTAGON: 7,
    OCTAGON: 8,
  };
  const sideCount = polygonSides[type];
  if (sideCount) {
    for (let index = 0; index < sideCount; index += 1) {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / sideCount;
      const pointX = centerX + Math.cos(angle) * (width / 2);
      const pointY = centerY + Math.sin(angle) * (height / 2);
      if (index === 0) context.moveTo(pointX, pointY);
      else context.lineTo(pointX, pointY);
    }
    context.closePath();
    return;
  }
  if (type === 'LINE' || type.includes('CONNECTOR')) {
    context.moveTo(x, y);
    context.lineTo(x + width, y + height);
    return;
  }
  if (type === 'ROUNDED_RECTANGLE') {
    const radius = Math.min(width, height) * 0.2;
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
    return;
  }
  context.rect(x, y, width, height);
}

function getEventPoint(
  canvas: HTMLCanvasElement | null,
  event: PointerEvent,
  scale: number,
): LayoutPoint | null {
  if (!canvas || scale <= 0) return null;
  const bounds = canvas.getBoundingClientRect();
  const renderX = ((event.clientX - bounds.left) * canvas.width) / bounds.width;
  const renderY = ((event.clientY - bounds.top) * canvas.height) / bounds.height;
  return {
    x: Math.max(0, renderX / scale),
    y: Math.max(0, renderY / scale),
  };
}
