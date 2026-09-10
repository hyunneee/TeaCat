import { useState, type ChangeEvent } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  LayoutGrid,
  MousePointer2,
  RefreshCw,
  Scan,
  Scissors,
  Square,
  Trash2,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  Input,
  Modal,
  SectionTitle,
  Select,
} from '@/shared/components/ui';
import type { StadiumEditorController } from '../hooks/useStadiumEditor';
import {
  acceptedSeatCount,
  buildSeatLabelPreview,
  candidateCenter,
  isInsideRect,
} from '../model/stadium.model';
import type {
  DraftArea,
  ExcelCandidate,
  LayoutRect,
  RowFormat,
  RowOrder,
  SeatOrder,
  StadiumAreaType,
} from '../model/stadium.types';
import { StadiumLayoutCanvas } from './StadiumLayoutCanvas';

const STEP_LABELS = [
  '공연장 정보',
  '배치 시작 방법',
  'Excel 업로드',
  '구역·좌석 지정',
  '확정',
] as const;

const AREA_TYPE_OPTIONS = [
  { value: 'SEATED', label: '지정 좌석' },
  { value: 'STANDING', label: '스탠딩' },
] as const;

const ROW_ORDER_OPTIONS = [
  { value: 'TOP_TO_BOTTOM', label: '위에서 아래' },
  { value: 'BOTTOM_TO_TOP', label: '아래에서 위' },
] as const;

const ROW_FORMAT_OPTIONS = [
  { value: 'ALPHA', label: '알파벳 (A, B, C…)' },
  { value: 'HANGUL', label: '가나다 (가, 나, 다…)' },
] as const;

const SEAT_ORDER_OPTIONS = [
  { value: 'LEFT_TO_RIGHT', label: '왼쪽에서 오른쪽' },
  { value: 'RIGHT_TO_LEFT', label: '오른쪽에서 왼쪽' },
] as const;

function clampRectToLayout(
  rect: LayoutRect,
  layoutWidth: number,
  layoutHeight: number,
): LayoutRect {
  const maxWidth = Math.max(1, layoutWidth);
  const maxHeight = Math.max(1, layoutHeight);
  const x = Math.min(Math.max(0, rect.x), maxWidth - 1);
  const y = Math.min(Math.max(0, rect.y), maxHeight - 1);
  const right = Math.min(maxWidth, Math.max(x + 1, rect.x + rect.width));
  const bottom = Math.min(maxHeight, Math.max(y + 1, rect.y + rect.height));

  return { x, y, width: right - x, height: bottom - y };
}

interface AdminStadiumWorkspaceProps {
  controller: StadiumEditorController;
  onExit: () => void;
}

export function AdminStadiumWorkspace({ controller, onExit }: AdminStadiumWorkspaceProps) {
  const { step, goToStep, analysis } = controller;
  const canGoBack = step > 0;
  const handleBack = () => {
    if (step === 3) goToStep(analysis ? 2 : 1);
    else goToStep(step - 1);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-ink text-lg font-bold">좌석 배치 관리</h1>
          <p className="text-ink-muted mt-1 text-sm">
            공연장을 찾거나 등록한 뒤 Excel 좌석표를 검수해 배치를 생성합니다.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft size={16} />}
          onClick={canGoBack ? handleBack : onExit}
        >
          {canGoBack ? '이전' : '대시보드로'}
        </Button>
      </div>

      <Card>
        <StepIndicator step={controller.step} />
      </Card>

      {controller.step === 0 && <StadiumInfoStep controller={controller} />}
      {controller.step === 1 && <LayoutSourceStep controller={controller} />}
      {controller.step === 2 && <ExcelUploadStep controller={controller} />}
      {controller.step === 3 && <AreaEditorStep controller={controller} />}
      {controller.step === 4 && <ConfirmStep controller={controller} />}
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {STEP_LABELS.map((label, index) => (
        <li
          key={label}
          className={
            index === step
              ? 'text-accent-800 font-bold'
              : index < step
                ? 'text-ink-muted font-medium'
                : 'text-ink-subtle font-medium'
          }
        >
          {index + 1}. {label}
        </li>
      ))}
    </ol>
  );
}

/* ── 1단계: 공연장 정보 ─────────────────────────────────── */

function StadiumInfoStep({ controller }: { controller: StadiumEditorController }) {
  const { info, setInfo, createStadium, stadiums, startLayoutForStadium } = controller;
  const [stadiumSearch, setStadiumSearch] = useState('');
  const normalizedSearch = stadiumSearch.trim().toLowerCase();
  const matchingStadiums = normalizedSearch
    ? (stadiums.data?.stadiums ?? [])
        .filter(
          (stadium) =>
            stadium.name.toLowerCase().includes(normalizedSearch) ||
            stadium.address.toLowerCase().includes(normalizedSearch),
        )
        .slice(0, 20)
    : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="기존 공연장에 새 배치 추가" />
        {stadiums.isPending ? (
          <p className="text-subtle text-sm">공연장 목록을 불러오는 중입니다.</p>
        ) : (
          <div className="space-y-3">
            <Input
              label="공연장 이름 또는 주소 검색"
              value={stadiumSearch}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setStadiumSearch(event.target.value)
              }
              placeholder="예: 고척, 구로구 경인로"
            />
            {!normalizedSearch ? (
              <p className="text-subtle text-sm">이름이나 주소를 입력해 공연장을 찾아 주세요.</p>
            ) : matchingStadiums.length > 0 ? (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {matchingStadiums.map((stadium) => (
                  <li key={stadium.stadiumId}>
                    <button
                      type="button"
                      onClick={() => startLayoutForStadium(stadium.stadiumId)}
                      className="hover:bg-surface-2 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{stadium.name}</span>
                        <span className="text-subtle block truncate text-xs">
                          {stadium.address}
                        </span>
                      </span>
                      <span className="text-accent-800 shrink-0 text-xs font-semibold">
                        배치 추가
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-subtle text-sm">검색 결과가 없습니다.</p>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="공연장 기본 정보" />
        <div className="space-y-3">
          <Input
            label="공연장 이름"
            required
            showRequirement
            value={info.name}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setInfo('name', event.target.value)}
            placeholder="예) 고척스카이돔"
          />
          <Input
            label="주소"
            required
            showRequirement
            value={info.address}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setInfo('address', event.target.value)
            }
            placeholder="예) 서울 구로구 경인로 430"
          />
          <Input
            label="전화번호"
            value={info.phone}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setInfo('phone', event.target.value)
            }
            placeholder="선택"
          />
          <Input
            label="최대 수용 인원"
            required
            showRequirement
            type="number"
            min={1}
            value={info.maxCapacity}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setInfo('maxCapacity', event.target.value)
            }
            placeholder="예: 25000"
          />
        </div>
        {createStadium.isError && (
          <p className="text-danger mt-3 text-sm">
            {createStadium.error instanceof Error
              ? createStadium.error.message
              : '등록에 실패했습니다.'}
          </p>
        )}
        <Button
          className="mt-4"
          fullWidth
          loading={createStadium.isPending}
          onClick={() => createStadium.mutate()}
        >
          새 공연장 등록 후 배치 만들기
        </Button>
      </Card>
    </div>
  );
}

/* ── 2단계: 배치 시작 방법 ─────────────────────────────── */

function LayoutSourceStep({ controller }: { controller: StadiumEditorController }) {
  const { layouts, startFromLayout, copyLayout, goToStep } = controller;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="기존 배치에서 시작" />
        <p className="text-muted mb-3 text-sm">
          기존 배치의 구역·좌석을 그대로 불러와 4단계 구역·좌석 지정 화면에서 이어서 고칩니다.
        </p>
        {startFromLayout.isError && (
          <p className="text-danger mb-3 text-sm">
            {startFromLayout.error instanceof Error
              ? startFromLayout.error.message
              : '배치를 불러오지 못했습니다.'}
          </p>
        )}
        {copyLayout.isError && (
          <p className="text-danger mb-3 text-sm">
            {copyLayout.error instanceof Error
              ? copyLayout.error.message
              : '배치를 복제하지 못했습니다.'}
          </p>
        )}
        {layouts.isPending ? (
          <p className="text-subtle text-sm">배치 목록을 불러오는 중입니다.</p>
        ) : layouts.data?.layouts.length ? (
          <ul className="space-y-2">
            {layouts.data.layouts.map((layout) => (
              <li
                key={layout.layoutId}
                className="surface-2 flex items-center justify-between gap-3 rounded-xl p-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {layout.name} {layout.isDefault && '· 기본'}
                  </span>
                  <span className="text-subtle block text-xs">
                    구역 {layout.areaCount}개 · 좌석 {layout.seatCount}석 · 스탠딩{' '}
                    {layout.standingCapacity}명 · 합계 {layout.capacity}명
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={startFromLayout.isPending}
                    onClick={() => startFromLayout.mutate(layout.layoutId)}
                  >
                    불러와 수정
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={copyLayout.isPending}
                    onClick={() =>
                      copyLayout.mutate({
                        layoutId: layout.layoutId,
                        name: `${layout.name} 복사본 ${layouts.data.layouts.length + 1}`,
                      })
                    }
                  >
                    그대로 복제
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-subtle text-sm">이 공연장에 등록된 배치가 아직 없습니다.</p>
        )}
      </Card>

      <Card>
        <CardHeader title="새 Excel로 시작" />
        <p className="text-muted mb-3 text-sm">
          기존 배치를 참고하지 않고 새 좌석표 Excel을 분석해 처음부터 만듭니다.
        </p>
        <Button fullWidth variant="secondary" onClick={() => goToStep(2)}>
          새 Excel로 처음부터 만들기
        </Button>
      </Card>

      <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => goToStep(0)}>
        공연장 선택으로
      </Button>
    </div>
  );
}

/* ── 3단계: Excel 업로드 ───────────────────────────────── */

function ExcelUploadStep({ controller }: { controller: StadiumEditorController }) {
  const { analyzeExcel, goToStep } = controller;
  const [file, setFile] = useState<File | null>(null);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    setFile(picked);
  };

  return (
    <Card>
      <CardHeader title="좌석표 Excel 업로드" />
      <p className="text-muted mb-3 text-sm">
        자유 형식의 .xlsx 파일을 업로드하면 셀과 도형에서 좌석·구역 후보를 분석합니다. 최대 20MB이며
        DB에는 저장되지 않습니다.
      </p>
      <label className="border-line hover:bg-surface-2 flex h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed text-sm">
        <FileSpreadsheet size={18} className="text-subtle" />
        {file ? file.name : '.xlsx 파일 선택'}
        <input type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
      </label>
      {analyzeExcel.isError && (
        <p className="text-danger mt-3 text-sm">
          {analyzeExcel.error instanceof Error
            ? analyzeExcel.error.message
            : '분석에 실패했습니다.'}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" leftIcon={<ArrowLeft size={16} />} onClick={() => goToStep(1)}>
          이전
        </Button>
        <Button
          fullWidth
          disabled={!file}
          loading={analyzeExcel.isPending}
          onClick={() => file && analyzeExcel.mutate(file)}
        >
          분석하기
        </Button>
      </div>
    </Card>
  );
}

/* ── 4단계: 구역·좌석 지정 ─────────────────────────────── */

function AreaEditorStep({ controller }: { controller: StadiumEditorController }) {
  const [pendingBounds, setPendingBounds] = useState<{
    areaId: string;
    bounds: LayoutRect;
    releasedCandidateCount: number;
    releasedManualSeatCount: number;
  } | null>(null);
  const [areaEditError, setAreaEditError] = useState<string | null>(null);
  const {
    analysis,
    selectedSheet,
    setSelectedSheet,
    layoutWidth,
    layoutHeight,
    tool,
    setTool,
    areas,
    selectedAreaId,
    selectArea,
    updateArea,
    updateAreaBounds,
    autoFitAreaBounds,
    splitArea,
    updateLabelingRule,
    removeArea,
    acceptCandidates,
    removeCandidates,
    removeManualSeats,
    assignManualSeats,
    toggleCandidate,
    addArea,
    addElement,
    layoutElements,
    selectedElementId,
    selectElement,
    updateElement,
    removeElement,
    ownerByCandidateId,
    candidatesForSheet,
    automaticSeatCandidateIdsForSheet,
    areasForSheet,
    unassignedSeatsForSheet,
    layoutElementsForSheet,
    selectedArea,
    selectedElement,
    validationIssues,
    focusValidationIssue,
  } = controller;

  if (!selectedSheet) return null;

  const floorTabs = analysis
    ? analysis.sheets.map((sheet) => ({
        name: sheet.name,
        label: `${sheet.name} (${sheet.rowCount}×${sheet.columnCount})`,
      }))
    : [
        ...new Set([
          ...areas.map((area) => area.levelCode),
          ...layoutElements.map((element) => element.levelCode),
        ]),
      ].map((name) => ({ name, label: name }));
  const invalidAreaIds = new Set(
    validationIssues.flatMap((issue) => (issue.areaId ? [issue.areaId] : [])),
  );

  const requestAreaBoundsChange = (areaId: string, bounds: LayoutRect) => {
    const area = areas.find((item) => item.clientId === areaId);
    if (!area) return;
    const nextBounds = clampRectToLayout(bounds, layoutWidth, layoutHeight);
    const candidateById = new Map(
      candidatesForSheet.seats.map((candidate) => [candidate.candidateId, candidate]),
    );
    const releasedCandidateCount = area.acceptedCandidateIds.filter((candidateId) => {
      const candidate = candidateById.get(candidateId);
      return candidate ? !isInsideRect(candidateCenter(candidate), nextBounds) : false;
    }).length;
    const releasedManualSeatCount = area.manualSeats.filter(
      (seat) => !isInsideRect({ x: seat.seatX, y: seat.seatY }, nextBounds),
    ).length;
    setAreaEditError(null);
    if (releasedCandidateCount + releasedManualSeatCount > 0) {
      setPendingBounds({
        areaId,
        bounds: nextBounds,
        releasedCandidateCount,
        releasedManualSeatCount,
      });
      return;
    }
    updateAreaBounds(areaId, nextBounds);
    setTool('pick-seats');
  };

  const requestSplitArea = (areaId: string, selection: LayoutRect) => {
    const area = areas.find((item) => item.clientId === areaId);
    if (!area || area.type !== 'SEATED') {
      setAreaEditError('지정 좌석 구역만 분할할 수 있습니다.');
      return;
    }
    const splitBounds = clampRectToLayout(selection, layoutWidth, layoutHeight);
    const candidateById = new Map(
      candidatesForSheet.seats.map((candidate) => [candidate.candidateId, candidate]),
    );
    const selectedCandidateCount = area.acceptedCandidateIds.filter((candidateId) => {
      const candidate = candidateById.get(candidateId);
      return candidate ? isInsideRect(candidateCenter(candidate), splitBounds) : false;
    }).length;
    const selectedManualSeatCount = area.manualSeats.filter((seat) =>
      isInsideRect({ x: seat.seatX, y: seat.seatY }, splitBounds),
    ).length;
    const selectedCount = selectedCandidateCount + selectedManualSeatCount;
    const totalCount = area.acceptedCandidateIds.length + area.manualSeats.length;
    if (selectedCount === 0) {
      setAreaEditError('분할할 좌석이 포함되도록 범위를 다시 지정해 주세요.');
      return;
    }
    if (selectedCount >= totalCount) {
      setAreaEditError('기존 구역에 좌석이 하나 이상 남도록 분할 범위를 줄여 주세요.');
      return;
    }
    setAreaEditError(null);
    splitArea(areaId, splitBounds);
  };
  return (
    <>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          {validationIssues.length > 0 && (
            <Card tone="danger">
              <p className="text-danger text-sm font-semibold">
                저장 전에 수정할 항목 {validationIssues.length}개
              </p>
              <p className="text-ink-muted mt-1 text-xs">
                항목을 누르면 오류가 난 층과 구역으로 이동합니다. 빨간 테두리 구역을 먼저
                확인하세요.
              </p>
              <ul className="mt-2 space-y-1">
                {validationIssues.map((issue, index) => (
                  <li key={`${issue.code}-${issue.areaId ?? issue.elementId ?? 'layout'}-${index}`}>
                    <button
                      type="button"
                      className="text-danger hover:bg-danger-soft w-full rounded-lg px-2 py-1.5 text-left text-xs"
                      onClick={() => focusValidationIssue(issue)}
                    >
                      {issue.message}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {analysis && analysis.warnings.length > 0 && (
            <Card tone="warning">
              <p className="text-sm font-semibold">분석 경고</p>
              <ul className="text-muted mt-1 list-disc space-y-0.5 pl-4 text-xs">
                {analysis.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="min-w-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                className="flex max-w-full gap-1 overflow-x-auto"
                role="tablist"
                aria-label="공연장 층"
              >
                {floorTabs.map((sheet) => (
                  <button
                    key={sheet.name}
                    type="button"
                    role="tab"
                    aria-selected={selectedSheet === sheet.name}
                    onClick={() => setSelectedSheet(sheet.name)}
                    className={
                      'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ' +
                      (selectedSheet === sheet.name
                        ? 'bg-accent-700 text-white'
                        : 'surface-2 text-ink-muted')
                    }
                  >
                    {sheet.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <ToolButton
                  icon={<Square size={16} />}
                  label="구역 그리기"
                  active={tool === 'draw-area'}
                  onClick={() => setTool('draw-area')}
                />
                <ToolButton
                  icon={<Scan size={16} />}
                  label="선택 구역 경계 다시 지정"
                  active={tool === 'resize-area'}
                  disabled={!selectedAreaId}
                  onClick={() => setTool('resize-area')}
                />
                <ToolButton
                  icon={<Scissors size={16} />}
                  label="선택 구역 분할"
                  active={tool === 'split-area'}
                  disabled={!selectedArea || selectedArea.type !== 'SEATED'}
                  onClick={() => setTool('split-area')}
                />
                <ToolButton
                  icon={<MousePointer2 size={16} />}
                  label="좌석 선택"
                  active={tool === 'pick-seats'}
                  onClick={() => setTool('pick-seats')}
                />
                <ToolButton
                  icon={<span className="text-base font-bold">＋</span>}
                  label="범위 좌석 추가"
                  active={tool === 'add-seat-range'}
                  onClick={() => setTool('add-seat-range')}
                />
                <ToolButton
                  icon={<span className="text-base font-bold">−</span>}
                  label="범위 좌석 제외"
                  active={tool === 'remove-seat-range'}
                  onClick={() => setTool('remove-seat-range')}
                />
                <ToolButton
                  icon={<LayoutGrid size={16} />}
                  label="고정 요소 그리기"
                  active={tool === 'draw-element'}
                  onClick={() => setTool('draw-element')}
                />
              </div>
            </div>
            <p className="text-subtle mt-2 text-xs">
              {tool === 'draw-area' &&
                '드래그한 구역 안에서 좌석 라벨·반복 채움 셀·반복 좌석 도형으로 인식된 항목만 자동 선택됩니다.'}
              {tool === 'resize-area' &&
                '새 경계를 드래그하세요. 경계 밖 좌석은 확인 후 미할당 상태로 전환됩니다.'}
              {tool === 'split-area' &&
                '기존 구역에서 새 구역으로 옮길 좌석 범위를 드래그하세요. 두 구역 경계는 좌석에 맞춰 자동 조정됩니다.'}
              {tool === 'pick-seats' && '셀·도형을 클릭해 좌석을 개별적으로 켜거나 끌 수 있습니다.'}
              {tool === 'add-seat-range' &&
                '선택한 구역 안을 드래그하면 범위에 포함된 미선택 좌석을 한 번에 추가합니다.'}
              {tool === 'remove-seat-range' &&
                '선택한 구역 안을 드래그하면 범위에 포함된 선택 좌석을 한 번에 제외합니다.'}
              {tool === 'draw-element' && '드래그해서 기둥·출입구 등 고정 요소 범위를 지정하세요.'}
            </p>
            <StadiumLayoutCanvas
              className="mt-3"
              layoutWidth={layoutWidth}
              layoutHeight={layoutHeight}
              seatCandidates={candidatesForSheet.seats}
              elementCandidates={candidatesForSheet.elements}
              areas={areasForSheet}
              unassignedSeats={unassignedSeatsForSheet}
              invalidAreaIds={invalidAreaIds}
              layoutElements={layoutElementsForSheet}
              selectedAreaId={selectedAreaId}
              selectedElementId={selectedElementId}
              tool={tool}
              ownerByCandidateId={ownerByCandidateId}
              automaticSeatCandidateIds={automaticSeatCandidateIdsForSheet}
              onAddArea={addArea}
              onUpdateAreaBounds={requestAreaBoundsChange}
              onSplitArea={requestSplitArea}
              onSelectArea={selectArea}
              onToggleCandidate={toggleCandidate}
              onRemoveManualSeats={removeManualSeats}
              onAssignManualSeats={assignManualSeats}
              onBulkCandidateChange={(areaId, rect, operation) => {
                const area = areas.find((item) => item.clientId === areaId);
                if (!area || area.type !== 'SEATED') return;
                const candidateIds = candidatesForSheet.seats
                  .filter((candidate) => {
                    const center = candidateCenter(candidate);
                    return isInsideRect(center, area.bounds) && isInsideRect(center, rect);
                  })
                  .filter((candidate) =>
                    operation === 'ADD'
                      ? !ownerByCandidateId.has(candidate.candidateId)
                      : area.acceptedCandidateIds.includes(candidate.candidateId),
                  )
                  .map((candidate) => candidate.candidateId);
                if (operation === 'ADD') {
                  acceptCandidates(areaId, candidateIds);
                  assignManualSeats(
                    areaId,
                    unassignedSeatsForSheet
                      .filter((seat) => isInsideRect({ x: seat.seatX, y: seat.seatY }, rect))
                      .map((seat) => seat.clientId),
                  );
                } else {
                  removeCandidates(areaId, candidateIds);
                  removeManualSeats(
                    areaId,
                    area.manualSeats
                      .filter((seat) => isInsideRect({ x: seat.seatX, y: seat.seatY }, rect))
                      .map((seat) => seat.clientId),
                  );
                }
              }}
              onAddElement={addElement}
              onSelectElement={selectElement}
            />
          </Card>
          {areaEditError && (
            <Card tone="warning">
              <p className="text-sm">{areaEditError}</p>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader title={`${selectedSheet} 구역 (${areasForSheet.length})`} />
            {areasForSheet.length === 0 ? (
              <p className="text-subtle text-sm">캔버스에 드래그해서 구역을 추가하세요.</p>
            ) : (
              <ul className="space-y-1.5">
                {areasForSheet.map((area) => (
                  <li key={area.clientId}>
                    <button
                      type="button"
                      onClick={() => selectArea(area.clientId)}
                      className={
                        'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors ' +
                        (area.clientId === selectedAreaId
                          ? 'bg-accent-700 text-white'
                          : invalidAreaIds.has(area.clientId)
                            ? 'bg-danger-soft text-danger'
                            : 'hover:bg-surface-2')
                      }
                    >
                      <span className="font-medium">{area.areaCode || '(코드 없음)'}</span>
                      <span className="text-xs opacity-80">
                        {area.type === 'STANDING'
                          ? `스탠딩 ${area.maxSeat}명`
                          : `좌석 ${acceptedSeatCount(area)}석`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {selectedArea && (
            <AreaDetailPanel
              key={selectedArea.clientId}
              area={selectedArea}
              candidates={candidatesForSheet.seats}
              onUpdate={(values) => updateArea(selectedArea.clientId, values)}
              onUpdateLabelingRule={(values) => updateLabelingRule(selectedArea.clientId, values)}
              onRedefineBounds={() => setTool('resize-area')}
              onAutoFitBounds={() => autoFitAreaBounds(selectedArea.clientId)}
              onSplit={() => setTool('split-area')}
              onRemove={() => removeArea(selectedArea.clientId)}
            />
          )}

          <Card>
            <CardHeader title={`${selectedSheet} 고정 요소 (${layoutElementsForSheet.length})`} />
            {layoutElementsForSheet.length === 0 ? (
              <p className="text-subtle text-sm">기둥·출입구 등은 선택 사항입니다.</p>
            ) : (
              <ul className="space-y-1.5">
                {layoutElementsForSheet.map((element) => (
                  <li key={element.clientId}>
                    <button
                      type="button"
                      onClick={() => selectElement(element.clientId)}
                      className={
                        'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors ' +
                        (element.clientId === selectedElementId
                          ? 'bg-accent-700 text-white'
                          : 'hover:bg-surface-2')
                      }
                    >
                      <span className="font-medium">{element.label}</span>
                      <span className="text-xs opacity-80">{element.type}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {selectedElement && (
            <Card>
              <CardHeader
                title="고정 요소 편집"
                action={
                  <button
                    type="button"
                    aria-label="고정 요소 삭제"
                    onClick={() => removeElement(selectedElement.clientId)}
                    className="text-danger hover:bg-danger-soft rounded-lg p-1.5"
                  >
                    <Trash2 size={16} />
                  </button>
                }
              />
              <div className="space-y-3">
                <Input
                  label="이름"
                  value={selectedElement.label}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateElement(selectedElement.clientId, { label: event.target.value })
                  }
                />
                <Input
                  label="종류"
                  value={selectedElement.type}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateElement(selectedElement.clientId, {
                      type: event.target.value.toUpperCase(),
                    })
                  }
                  hint="예: PILLAR, GATE, AISLE"
                />
              </div>
            </Card>
          )}

          <Card>
            <p className="text-ink-muted mb-3 text-xs">
              미할당 기존 좌석 {unassignedSeatsForSheet.length}석 · 좌석을 제외해도 삭제되지 않으며
              다른 구역에 다시 할당할 수 있습니다.
            </p>
            {validationIssues.length > 0 && (
              <p className="text-danger mb-3 text-sm">
                위의 오류를 모두 수정해야 확정 단계로 이동할 수 있습니다.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                leftIcon={<ArrowLeft size={16} />}
                onClick={() => controller.goToStep(analysis ? 2 : 1)}
              >
                이전
              </Button>
              <Button
                fullWidth
                disabled={validationIssues.length > 0}
                onClick={() => controller.goToStep(4)}
              >
                배치 확정하러 가기
              </Button>
            </div>
          </Card>
        </div>
      </div>
      <Modal
        open={pendingBounds !== null}
        variant="center"
        title="경계 밖 좌석을 미할당으로 전환할까요?"
        description="좌석 데이터는 삭제되지 않으며 다른 구역에 다시 할당할 수 있습니다."
        onClose={() => setPendingBounds(null)}
        footer={
          <div className="flex gap-2">
            <Button variant="soft" fullWidth onClick={() => setPendingBounds(null)}>
              취소
            </Button>
            <Button
              fullWidth
              onClick={() => {
                if (!pendingBounds) return;
                updateAreaBounds(pendingBounds.areaId, pendingBounds.bounds);
                setPendingBounds(null);
                setTool('pick-seats');
              }}
            >
              경계 변경
            </Button>
          </div>
        }
      >
        {pendingBounds && (
          <p className="text-ink-muted text-sm leading-relaxed">
            Excel 후보 {pendingBounds.releasedCandidateCount}석, 기존 좌석{' '}
            {pendingBounds.releasedManualSeatCount}석이 현재 구역에서 제외됩니다.
          </p>
        )}
      </Modal>
    </>
  );
}

function ToolButton({
  icon,
  label,
  active,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={
        'flex size-9 items-center justify-center rounded-lg transition-colors ' +
        (active ? 'bg-accent-700 text-white' : 'surface-2 text-ink-muted hover:bg-surface-3') +
        (disabled ? ' cursor-not-allowed opacity-40' : '')
      }
    >
      {icon}
    </button>
  );
}

function AreaDetailPanel({
  area,
  candidates,
  onUpdate,
  onUpdateLabelingRule,
  onRedefineBounds,
  onAutoFitBounds,
  onSplit,
  onRemove,
}: {
  area: DraftArea;
  candidates: ExcelCandidate[];
  onUpdate: (values: Partial<{ areaCode: string; type: StadiumAreaType; maxSeat: number }>) => void;
  onUpdateLabelingRule: (
    values: Partial<{
      rowOrder: RowOrder;
      rowFormat: RowFormat;
      startRowLabel: string;
      seatOrder: SeatOrder;
      startNumber: number;
    }>,
  ) => void;
  onRedefineBounds: () => void;
  onAutoFitBounds: () => void;
  onSplit: () => void;
  onRemove: () => void;
}) {
  const labelPreview = buildSeatLabelPreview(area, candidates);

  return (
    <Card>
      <CardHeader
        title="구역 편집"
        action={
          <button
            type="button"
            aria-label="구역 삭제"
            onClick={onRemove}
            className="text-danger hover:bg-danger-soft rounded-lg p-1.5"
          >
            <Trash2 size={16} />
          </button>
        }
      />
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Button
          variant="soft"
          size="sm"
          className={area.type === 'STANDING' ? 'col-span-2' : undefined}
          onClick={onRedefineBounds}
        >
          경계 다시 지정
        </Button>
        {area.type === 'SEATED' && (
          <>
            <Button variant="soft" size="sm" onClick={onAutoFitBounds}>
              좌석에 맞춤
            </Button>
            <Button variant="soft" size="sm" className="col-span-2" onClick={onSplit}>
              선택 범위로 구역 분할
            </Button>
          </>
        )}
      </div>
      <div className="space-y-3">
        <Input
          label="구역 코드"
          value={area.areaCode}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onUpdate({ areaCode: event.target.value })
          }
        />
        <div className="flex items-center justify-between">
          <span className="text-ink-muted text-sm font-medium">구역 종류</span>
          <Select
            label="구역 종류"
            value={area.type}
            onChange={(value) => onUpdate({ type: value })}
            options={AREA_TYPE_OPTIONS}
          />
        </div>

        {area.type === 'STANDING' ? (
          <Input
            label="수용 인원"
            type="number"
            min={1}
            value={area.maxSeat}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate({ maxSeat: Number(event.target.value) || 1 })
            }
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted text-sm font-medium">행 순서</span>
              <Select
                label="행 순서"
                value={area.labelingRule.rowOrder}
                onChange={(value) => onUpdateLabelingRule({ rowOrder: value })}
                options={ROW_ORDER_OPTIONS}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted text-sm font-medium">행 라벨</span>
              <Select
                label="행 라벨"
                value={area.labelingRule.rowFormat}
                onChange={(value) =>
                  onUpdateLabelingRule({
                    rowFormat: value,
                    startRowLabel: value === 'ALPHA' ? 'A' : '가',
                  })
                }
                options={ROW_FORMAT_OPTIONS}
              />
            </div>
            <Input
              label={
                area.labelingRule.rowFormat === 'ALPHA' ? '시작 행 알파벳' : '시작 행 (가나다)'
              }
              value={area.labelingRule.startRowLabel}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onUpdateLabelingRule({
                  startRowLabel:
                    area.labelingRule.rowFormat === 'ALPHA'
                      ? event.target.value.toUpperCase()
                      : event.target.value,
                })
              }
              placeholder={
                area.labelingRule.rowFormat === 'ALPHA' ? '예: A, C, AA' : '예: 가, 다, 마'
              }
            />
            <div className="flex items-center justify-between">
              <span className="text-ink-muted text-sm font-medium">좌석 순서</span>
              <Select
                label="좌석 순서"
                value={area.labelingRule.seatOrder}
                onChange={(value) => onUpdateLabelingRule({ seatOrder: value })}
                options={SEAT_ORDER_OPTIONS}
              />
            </div>
            <Input
              label="시작 번호"
              type="number"
              min={1}
              value={area.labelingRule.startNumber}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onUpdateLabelingRule({ startNumber: Number(event.target.value) || 1 })
              }
            />

            <p className="text-subtle text-xs">
              Excel에서 선택한 좌석 {area.acceptedCandidateIds.length}석 · 기존 배치에서 가져온 좌석{' '}
              {area.manualSeats.length}석
            </p>
            {labelPreview.length > 0 && (
              <div className="bg-surface-2 rounded-lg p-2.5">
                <p className="text-ink-muted text-xs font-semibold">
                  저장될 자동 좌석 라벨 미리보기
                </p>
                <p className="text-subtle mt-1 text-xs break-words">
                  {labelPreview
                    .slice(0, 20)
                    .map((seat) => seat.label)
                    .join(', ')}
                  {labelPreview.length > 20 && ` 외 ${labelPreview.length - 20}석`}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

/* ── 5단계: 확정 ────────────────────────────────────────── */

function ConfirmStep({ controller }: { controller: StadiumEditorController }) {
  const {
    layoutName,
    setLayoutName,
    isDefault,
    setIsDefault,
    confirmLayout,
    copyLayout,
    areas,
    layoutCapacity,
    stadiumMaxCapacity,
    reset,
  } = controller;

  if (confirmLayout.isSuccess || copyLayout.isSuccess) {
    const result = (confirmLayout.data ?? copyLayout.data)!;
    return (
      <Card tone="success">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={20} className="text-accent-700" />
          <p className="font-bold">공연장 배치가 저장되었습니다.</p>
        </div>
        <p className="text-muted mt-2 text-sm">
          구역 {result.createdAreaCount}개, 좌석 {result.createdSeatCount}석이 등록됐습니다.
        </p>
        <Button
          className="mt-4"
          variant="secondary"
          leftIcon={<RefreshCw size={16} />}
          onClick={reset}
        >
          다른 공연장·배치 작업
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="배치 확정" />
      <div className="space-y-3">
        <Input
          label="배치 이름"
          value={layoutName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setLayoutName(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          이 공연장의 기본 배치로 지정
        </label>
        <SectionTitle description="확정하면 구역과 좌석이 하나의 트랜잭션으로 저장됩니다.">
          요약
        </SectionTitle>
        <ul className="text-muted space-y-1 text-sm">
          {areas.map((area) => (
            <li key={area.clientId}>
              {area.areaCode} —{' '}
              {area.type === 'STANDING'
                ? `스탠딩 ${area.maxSeat}명`
                : `좌석 ${acceptedSeatCount(area)}석`}
            </li>
          ))}
        </ul>
        <p
          className={
            stadiumMaxCapacity !== null && layoutCapacity > stadiumMaxCapacity
              ? 'text-danger text-sm font-semibold'
              : 'text-ink text-sm font-semibold'
          }
        >
          배치 수용 인원 {layoutCapacity.toLocaleString()}명
          {stadiumMaxCapacity !== null && ` / 공연장 최대 ${stadiumMaxCapacity.toLocaleString()}명`}
        </p>
      </div>
      {confirmLayout.isError && (
        <p className="text-danger mt-3 text-sm">
          {confirmLayout.error instanceof Error
            ? confirmLayout.error.message
            : '저장에 실패했습니다.'}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" onClick={() => controller.goToStep(3)}>
          이전으로
        </Button>
        <Button
          fullWidth
          loading={confirmLayout.isPending}
          onClick={() => confirmLayout.mutate('PUBLISH')}
        >
          배치 확정하기
        </Button>
      </div>
    </Card>
  );
}
