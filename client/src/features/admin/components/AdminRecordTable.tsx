import type { ReactNode } from 'react';
import { Button, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';

/**
 * 회원 상세의 기록 표 껍데기.
 *
 * 예매·보유 포카·구매·판매 네 표가 <b>머리글 · 로딩 · 빈 상태 · 더 보기</b> 를 똑같이 씁니다.
 * 각자 그리면 네 번째 표에서 빈 문구만 다르거나 더 보기가 빠지는 식으로 어긋납니다.
 * 다른 것은 열 구성뿐이라 그것만 `children` 으로 받습니다.
 *
 * 서버를 모릅니다 — props 로 받은 것만 그립니다 (CLAUDE.md 4-3).
 */
export interface AdminRecordTableProps {
  headers: readonly string[];
  isLoading: boolean;
  /** 표에 그릴 `<tr>` 들 */
  children: ReactNode;
  /** 한 줄도 없을 때 */
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  /** 커서 목록에만 있습니다. 예매는 페이지가 없어 넘기지 않습니다 */
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onMore?: () => void;
}

export function AdminRecordTable({
  headers,
  isLoading,
  children,
  isEmpty,
  emptyTitle,
  emptyDescription,
  hasMore,
  isLoadingMore,
  onMore,
}: AdminRecordTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      {/* 표가 좁아지면 안쪽에서 가로 스크롤합니다 — 페이지가 밀리면 사이드바가 흔들립니다 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-2xl border-collapse text-sm">
          <thead>
            <tr className="border-line border-b text-left">
              {headers.map((header, i) => (
                <th
                  key={header || `col-${i}`}
                  scope="col"
                  className="text-ink-muted px-4 py-2.5 text-xs font-medium"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>

      {/* 🔴 스크롤이 아니라 버튼입니다 — 아래에 다음 표가 이어지는 화면이라, 스크롤 끝에서
          자동으로 불러오면 그 아래에 영영 닿지 못합니다 */}
      {hasMore && (
        <div className="flex justify-center p-3">
          <Button variant="soft" size="sm" loading={isLoadingMore} onClick={onMore}>
            더 보기
          </Button>
        </div>
      )}
    </>
  );
}
