import { Badge, Button, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { STATUS_LABEL, STATUS_TONE, TYPE_LABEL, type InquirySummary } from '@/features/inquiry';

/**
 * 문의 표.
 *
 * 서버를 모릅니다 — props 로 받은 것만 그립니다 (CLAUDE.md 4-3).
 */
export interface AdminInquiryTableProps {
  inquiries: InquirySummary[];
  isLoading: boolean;
  /** 지금 열려 있는 문의 — 표에서 어느 줄을 보고 있는지 표시합니다 */
  selectedId: number | null;
  onSelect: (inquiryId: number) => void;
}

const HEADERS = ['상태', '유형', '제목', '작성자', '접수일', ''] as const;

/** 2026-09-09 */
const formatDate = (iso: string) => iso.slice(0, 10);

export function AdminInquiryTable({
  inquiries,
  isLoading,
  selectedId,
  onSelect,
}: AdminInquiryTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (inquiries.length === 0) {
    return (
      <EmptyState title="조건에 맞는 문의가 없어요" description="상태나 유형 필터를 바꿔보세요." />
    );
  }

  return (
    // 표가 좁아지면 안쪽에서 가로 스크롤합니다. 페이지 자체가 밀리면 사이드바가 흔들립니다
    <div className="overflow-x-auto">
      <table className="w-full min-w-3xl border-collapse text-sm">
        <thead>
          <tr className="border-line border-b text-left">
            {HEADERS.map((header, i) => (
              <th
                key={header || `action-${i}`}
                scope="col"
                className="text-ink-muted px-4 py-2.5 text-xs font-medium"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {inquiries.map((inquiry) => (
            <tr
              key={inquiry.inquiryId}
              className={
                inquiry.inquiryId === selectedId
                  ? 'border-line/60 bg-surface-2 border-b last:border-0'
                  : 'border-line/60 hover:bg-surface-2 border-b last:border-0'
              }
            >
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONE[inquiry.status]}>{STATUS_LABEL[inquiry.status]}</Badge>
              </td>

              <td className="px-4 py-3">
                <Badge tone="quiet">{TYPE_LABEL[inquiry.type]}</Badge>
              </td>

              <td className="max-w-md px-4 py-3">
                <p className="text-ink truncate font-medium">{inquiry.title}</p>
              </td>

              <td className="text-ink px-4 py-3">{inquiry.writerNickname}</td>

              <td className="text-ink-muted px-4 py-3 text-xs tabular-nums">
                {formatDate(inquiry.createdAt)}
              </td>

              <td className="px-4 py-3 text-right">
                <Button variant="ghost" size="sm" onClick={() => onSelect(inquiry.inquiryId)}>
                  열기
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
