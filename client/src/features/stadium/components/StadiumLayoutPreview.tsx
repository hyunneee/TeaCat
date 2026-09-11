import { useState } from 'react';
import { Armchair } from 'lucide-react';
import { EmptyState } from '@/shared/components/common';
import { Card, Skeleton } from '@/shared/components/ui';
import type { DraftArea, DraftLayoutElement, LayoutRect } from '../model/stadium.types';
import { StadiumLayoutCanvas } from './StadiumLayoutCanvas';

const EMPTY_MAP = new Map<string, string>();
const EMPTY_SET = new Set<string>();
const noopRect = (_rect: LayoutRect) => undefined;
const noopAreaBounds = (_areaId: string, _rect: LayoutRect) => undefined;
const noopAreaRect = (_areaId: string, _rect: LayoutRect, _operation: 'ADD' | 'REMOVE') =>
  undefined;
const noopCandidate = (_areaId: string, _candidateId: string) => undefined;
const noopSeats = (_areaId: string, _seatClientIds: string[]) => undefined;

export function StadiumLayoutPreview({
  name,
  width,
  height,
  areas,
  layoutElements,
  isLoading,
}: {
  name?: string;
  width?: number;
  height?: number;
  areas?: DraftArea[];
  layoutElements?: DraftLayoutElement[];
  isLoading: boolean;
}) {
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-[32rem] w-full" />
      </Card>
    );
  }

  if (!areas || width === undefined || height === undefined) {
    return (
      <Card>
        <EmptyState
          icon={Armchair}
          title="확인할 배치를 선택해 주세요"
          description="왼쪽 배치 목록을 클릭하면 좌석 배치표가 여기에 표시됩니다."
          className="min-h-[32rem]"
        />
      </Card>
    );
  }

  const floors = Array.from(
    new Set([
      ...areas.map((area) => area.levelCode),
      ...(layoutElements ?? []).map((item) => item.levelCode),
    ]),
  );
  const activeFloor = floors.includes(selectedFloor ?? '')
    ? (selectedFloor as string)
    : (floors[0] ?? '1F');
  const floorAreas = areas.filter((area) => area.levelCode === activeFloor);
  const floorElements = (layoutElements ?? []).filter(
    (element) => element.levelCode === activeFloor,
  );

  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-ink font-bold">{name}</h2>
          <p className="text-ink-muted text-xs">
            구역 {areas.length}개 · 좌석{' '}
            {areas.reduce((sum, area) => sum + area.manualSeats.length, 0).toLocaleString()}석
          </p>
        </div>
        {floors.length > 1 && (
          <div className="flex gap-1" role="tablist" aria-label="공연장 층">
            {floors.map((floor) => (
              <button
                key={floor}
                type="button"
                role="tab"
                aria-selected={floor === activeFloor}
                onClick={() => {
                  setSelectedFloor(floor);
                  setSelectedAreaId(null);
                  setSelectedElementId(null);
                }}
                className={
                  'rounded-lg px-3 py-1.5 text-sm font-medium ' +
                  (floor === activeFloor
                    ? 'bg-accent-700 text-white'
                    : 'surface-2 text-ink-muted hover:bg-surface-3')
                }
              >
                {floor}
              </button>
            ))}
          </div>
        )}
      </div>

      <StadiumLayoutCanvas
        layoutWidth={width}
        layoutHeight={height}
        seatCandidates={[]}
        elementCandidates={[]}
        areas={floorAreas}
        unassignedSeats={[]}
        layoutElements={floorElements}
        selectedAreaId={selectedAreaId}
        selectedElementId={selectedElementId}
        tool="pick-seats"
        ownerByCandidateId={EMPTY_MAP}
        automaticSeatCandidateIds={EMPTY_SET}
        onAddArea={noopRect}
        onUpdateAreaBounds={noopAreaBounds}
        onSplitArea={noopAreaBounds}
        onSelectArea={setSelectedAreaId}
        onToggleCandidate={noopCandidate}
        onRemoveManualSeats={noopSeats}
        onAssignManualSeats={noopSeats}
        onBulkCandidateChange={noopAreaRect}
        onAddElement={noopRect}
        onSelectElement={setSelectedElementId}
      />
      <p className="text-ink-muted mt-2 text-xs">
        구역을 클릭해 강조해서 볼 수 있고, 오른쪽 위 버튼으로 확대·축소할 수 있습니다.
      </p>
    </Card>
  );
}
