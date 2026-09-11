import { Building2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { EmptyState } from '@/shared/components/common';
import { Button, Input, Skeleton } from '@/shared/components/ui';
import type { StadiumSummary } from '../model/stadium.types';

export function AdminStadiumToolbar({
  keyword,
  onSearch,
  onCreate,
}: {
  keyword: string;
  onSearch: (keyword: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="border-line flex items-center gap-2 border-b p-4">
      <Input
        className="max-w-sm"
        leftIcon={<Search size={16} />}
        placeholder="공연장 이름·주소·전화번호"
        value={keyword}
        onChange={(event) => onSearch(event.target.value)}
        onClear={() => onSearch('')}
        aria-label="공연장 검색"
      />
      <div className="flex-1" />
      <Button variant="dark" size="sm" leftIcon={<Plus size={16} />} onClick={onCreate}>
        공연장 등록하기
      </Button>
    </div>
  );
}

export function AdminStadiumTable({
  stadiums,
  isLoading,
  onOpen,
  onEdit,
  onDelete,
}: {
  stadiums: StadiumSummary[];
  isLoading: boolean;
  onOpen: (stadium: StadiumSummary) => void;
  onEdit: (stadium: StadiumSummary) => void;
  onDelete: (stadium: StadiumSummary) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (stadiums.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="조건에 맞는 공연장이 없어요"
        description="검색어를 바꾸거나 새 공연장을 등록해 주세요."
        className="min-h-72"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-3xl border-collapse text-sm">
        <thead>
          <tr className="border-line border-b text-left">
            {['공연장', '연락처', '구역', '수용 인원', ''].map((header, index) => (
              <th
                key={header || `action-${index}`}
                scope="col"
                className="text-ink-muted px-4 py-2.5 text-xs font-medium"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stadiums.map((stadium) => (
            <tr
              key={stadium.stadiumId}
              tabIndex={0}
              className="border-line/60 hover:bg-surface-2 focus-visible:bg-surface-2 cursor-pointer border-b transition-colors last:border-0 focus-visible:outline-none"
              onClick={() => onOpen(stadium)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                onOpen(stadium);
              }}
            >
              <td className="px-4 py-3">
                <p className="text-ink font-medium">{stadium.name}</p>
                <p className="text-ink-muted max-w-md truncate text-xs">{stadium.address}</p>
              </td>
              <td className="text-ink-muted px-4 py-3 text-xs tabular-nums">
                {stadium.phone ?? '—'}
              </td>
              <td className="text-ink px-4 py-3 tabular-nums">{stadium.areaCount}개</td>
              <td className="text-ink px-4 py-3 tabular-nums">
                {stadium.maxCapacity.toLocaleString()}명
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Pencil size={14} />}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(stadium);
                    }}
                  >
                    수정
                  </Button>
                  <Button
                    variant="danger-ghost"
                    size="sm"
                    leftIcon={<Trash2 size={14} />}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(stadium);
                    }}
                  >
                    삭제
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
