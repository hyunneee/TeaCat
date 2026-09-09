import { useState } from 'react';
import { Card, Segmented } from '@/shared/components/ui';
import {
  AdminInquiryAnswerModal,
  AdminInquiryTable,
  AdminPagination,
  BentoGrid,
  StatTile,
  useAdminInquiries,
  useAdminInquiry,
  useAdminInquiryStats,
  useAnswerInquiry,
  useReopenInquiry,
  useResolveInquiry,
} from '@/features/admin';
import { STATUS_LABEL, TYPE_LABEL, type InquiryStatus, type InquiryType } from '@/features/inquiry';

/** '전체' 는 필터를 걸지 않는다는 뜻이라 값이 없습니다 */
const ALL = 'ALL';

const STATUS_OPTIONS = [
  { value: ALL, label: '전체' },
  ...(['OPEN', 'ANSWERED', 'RESOLVED'] as InquiryStatus[]).map((s) => ({
    value: s,
    label: STATUS_LABEL[s],
  })),
];

const TYPE_OPTIONS = [
  { value: ALL, label: '전체' },
  ...(['BUG', 'IMPROVEMENT', 'ETC'] as InquiryType[]).map((t) => ({
    value: t,
    label: TYPE_LABEL[t],
  })),
];

/**
 * 문의 관리.
 *
 * 페이지는 조립만 합니다 — 훅을 불러 컴포넌트에 내려줍니다 (CLAUDE.md 3-6).
 * 접근 제어는 라우터의 `RequireRole(['ADMIN'])` 이 이미 끝냈습니다.
 */
export function AdminInquiriesPage() {
  const list = useAdminInquiries();
  const stats = useAdminInquiryStats();

  /** 지금 열어 놓은 문의. 목록 옆이 아니라 모달로 띄웁니다 — 본문이 길어 표를 밀어냅니다 */
  const [openedId, setOpenedId] = useState<number | null>(null);
  const opened = useAdminInquiry(openedId);

  const answer = useAnswerInquiry();
  const resolve = useResolveInquiry();
  const reopen = useReopenInquiry();

  const page = list.data;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold text-ink">문의 관리</h1>
        <p className="text-sm text-ink-muted">
          회원이 남긴 오류 신고와 개선 제안에 답하고, 처리가 끝나면 해결로 표시합니다.
        </p>
      </div>

      <BentoGrid>
        <StatTile span={4} label="답변 대기" value={stats.data?.open} unit="건" />
        <StatTile span={4} label="답변 완료" value={stats.data?.answered} unit="건" />
        <StatTile span={4} label="해결" value={stats.data?.resolved} unit="건" />
      </BentoGrid>

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 border-b border-line p-4">
          <Segmented
            options={STATUS_OPTIONS}
            value={list.status ?? ALL}
            onChange={(value) => list.filterStatus(value === ALL ? null : (value as InquiryStatus))}
          />
          <Segmented
            options={TYPE_OPTIONS}
            value={list.type ?? ALL}
            onChange={(value) => list.filterType(value === ALL ? null : (value as InquiryType))}
          />
        </div>

        <AdminInquiryTable
          inquiries={page?.inquiries ?? []}
          isLoading={list.isPending}
          selectedId={openedId}
          onSelect={setOpenedId}
        />

        <AdminPagination
          page={page?.page ?? 0}
          totalPages={page?.totalPages ?? 0}
          totalElements={page?.totalElements ?? 0}
          unit="건"
          onChange={list.setPage}
        />
      </Card>

      {openedId !== null && (
        <AdminInquiryAnswerModal
          inquiry={opened.data}
          isLoading={opened.isPending}
          answering={answer.isPending}
          resolving={resolve.isPending || reopen.isPending}
          onClose={() => setOpenedId(null)}
          onAnswer={(text) => answer.mutate({ inquiryId: openedId, answer: text })}
          onResolve={() => resolve.mutate(openedId)}
          onReopen={() => reopen.mutate(openedId)}
        />
      )}
    </div>
  );
}
