import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input, Select } from '@/shared/components/ui';
import { CHECK_IN_FILTER_LABEL } from '../model/operations.model';
import type {
  AttendeeQuery,
  OperationsArea,
  OperationsCheckInFilter,
} from '../model/operations.types';

/** 검색을 입력마다 보내면 글자 수만큼 요청이 나갑니다 (회원 관리와 같은 값) */
const SEARCH_DEBOUNCE_MS = 300;

const CHECK_IN_OPTIONS = (Object.keys(CHECK_IN_FILTER_LABEL) as OperationsCheckInFilter[]).map(
  (value) => ({ value, label: CHECK_IN_FILTER_LABEL[value] }),
);

interface Props {
  query: AttendeeQuery;
  /** 구역 선택에 쓸 목록. 스탠딩 구역도 포함합니다 — 명단은 스탠딩도 거를 수 있어야 합니다 */
  areas: OperationsArea[];
  totalCount: number;
  onSearch: (keyword: string) => void;
  onFilterArea: (areaId: number | null) => void;
  onFilterCheckIn: (checkIn: OperationsCheckInFilter) => void;
}

/**
 * 명단 검색·필터 (순수 View).
 *
 * 🔴 **거르는 일은 서버가 합니다.** 받은 한 페이지만 브라우저에서 걸러내면 다음 페이지에 있는
 *    결과가 빠집니다. 여기서 하는 일은 조건을 위로 올리는 것뿐입니다.
 */
export function OperationsAttendeeToolbar({
  query,
  areas,
  totalCount,
  onSearch,
  onFilterArea,
  onFilterCheckIn,
}: Props) {
  /* 입력은 즉시 반응해야 하고(글자가 늦게 보이면 고장 같습니다) 요청은 늦게 나가야 하므로,
     화면용 값을 따로 들고 있다가 조용해지면 위로 올립니다. */
  const [draft, setDraft] = useState(query.keyword);

  /* 회차가 바뀌면 훅이 검색어를 비웁니다 — 입력창에 남아 있으면 필터가 걸린 것처럼 보입니다 */
  useEffect(() => {
    if (query.keyword === '') setDraft('');
  }, [query.keyword]);

  useEffect(() => {
    if (draft === query.keyword) return;

    const timer = setTimeout(() => onSearch(draft), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, query.keyword, onSearch]);

  const areaOptions = [
    { value: '', label: '전 구역' },
    ...areas.map((area) => ({
      value: String(area.areaId),
      label: `${area.areaCode}구역${area.grade ? ` · ${area.grade}석` : ''}`,
    })),
  ];

  return (
    <div className="border-line flex flex-wrap items-center gap-3 border-b p-4">
      <div className="min-w-0">
        <h2 className="text-ink text-sm font-semibold">예매자 명단</h2>
        <p className="text-ink-muted text-xs tabular-nums">{totalCount}명</p>
      </div>

      <Input
        className="ml-auto max-w-xs"
        leftIcon={<Search size={16} />}
        placeholder="이름·닉네임·티켓 번호"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onClear={() => setDraft('')}
        aria-label="예매자 검색"
      />

      <Select
        label="구역"
        options={areaOptions}
        value={query.areaId === null ? '' : String(query.areaId)}
        onChange={(value) => onFilterArea(value === '' ? null : Number(value))}
      />

      <Select
        label="입장 상태"
        options={CHECK_IN_OPTIONS}
        value={query.checkIn}
        onChange={(value) => onFilterCheckIn(value as OperationsCheckInFilter)}
      />
    </div>
  );
}
