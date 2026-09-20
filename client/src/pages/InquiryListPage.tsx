import { useNavigate } from 'react-router-dom';
import { MessageSquarePlus } from 'lucide-react';
import { DetailHeader as Header } from '@/shared/components/layout';
import { EmptyState, Loading } from '@/shared/components/common';
import { Badge, Button, Card } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';
import { formatDateTime } from '@/shared/lib';
import { STATUS_LABEL, STATUS_TONE, TYPE_LABEL, useMyInquiries } from '@/features/inquiry';

/** 내가 남긴 문의 목록. 상태(답변 대기·답변 완료·해결)를 한눈에 봅니다 */
export function InquiryListPage() {
  const navigate = useNavigate();
  const { data, isPending, page, setPage } = useMyInquiries();

  return (
    <>
      <Header title="문의 내역" showBack />

      <div className="space-y-4 p-4">
        <Button
          variant="dark"
          size="lg"
          className="w-full lg:w-auto"
          leftIcon={<MessageSquarePlus size={18} />}
          onClick={() => navigate(ROUTES.MY_INQUIRY_NEW)}
        >
          문의하기
        </Button>

        {isPending ? (
          <Loading label="문의를 불러오는 중" />
        ) : data && data.inquiries.length > 0 ? (
          <>
            <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
              {data.inquiries.map((inquiry) => (
                <li key={inquiry.inquiryId}>
                  <Card
                    interactive
                    onClick={() => navigate(ROUTES.MY_INQUIRY_DETAIL(String(inquiry.inquiryId)))}
                  >
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">{TYPE_LABEL[inquiry.type]}</Badge>
                      <Badge tone={STATUS_TONE[inquiry.status]}>
                        {STATUS_LABEL[inquiry.status]}
                      </Badge>
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold">{inquiry.title}</p>
                    <p className="text-subtle mt-1 text-xs">{formatDateTime(inquiry.createdAt)}</p>
                  </Card>
                </li>
              ))}
            </ul>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 0}
                  onClick={() => setPage(page - 1)}
                >
                  이전
                </Button>
                <span className="text-subtle text-xs tabular-nums">
                  {page + 1} / {data.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= data.totalPages - 1}
                  onClick={() => setPage(page + 1)}
                >
                  다음
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            title="아직 남긴 문의가 없어요"
            description="오류를 발견했거나 개선할 점이 있으면 알려주세요."
          />
        )}
      </div>
    </>
  );
}
