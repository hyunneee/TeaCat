import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { EmptyState, Loading } from '@/shared/components/common';
import { Badge, Button, Card, SectionTitle } from '@/shared/components/ui';
import { useModal } from '@/app/providers';
import { ROUTES } from '@/shared/constants';
import { formatDateTime } from '@/shared/lib';
import {
  STATUS_LABEL,
  STATUS_TONE,
  TYPE_LABEL,
  useDeleteInquiry,
  useInquiry,
} from '@/features/inquiry';

/** 내 문의 상세. 관리자 답변과 처리 상태를 함께 봅니다 */
export function InquiryDetailPage() {
  const navigate = useNavigate();
  const { open } = useModal();
  const { inquiryId } = useParams<{ inquiryId: string }>();
  const id = Number(inquiryId);

  const { data: inquiry, isPending, isError } = useInquiry(id);
  const remove = useDeleteInquiry();

  if (isPending) return <Loading label="문의를 불러오는 중" />;

  if (isError || !inquiry) {
    return (
      <>
        <Header title="문의" showBack />
        <EmptyState title="문의를 찾을 수 없어요" description="삭제됐거나 잘못된 주소입니다." />
      </>
    );
  }

  return (
    <>
      <Header title="문의" showBack />

      <div className="space-y-6 p-4">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge tone="neutral">{TYPE_LABEL[inquiry.type]}</Badge>
            <Badge tone={STATUS_TONE[inquiry.status]}>{STATUS_LABEL[inquiry.status]}</Badge>
          </div>

          <div>
            <h1 className="text-lg font-extrabold">{inquiry.title}</h1>
            <p className="text-subtle mt-1 text-xs">{formatDateTime(inquiry.createdAt)}</p>
          </div>

          <Card className="text-sm leading-relaxed break-words whitespace-pre-wrap">{inquiry.content}</Card>
        </section>

        <section>
          <SectionTitle>답변</SectionTitle>
          {inquiry.answer ? (
            <Card className="space-y-2">
              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{inquiry.answer}</p>
              <p className="text-subtle text-xs">
                {inquiry.answeredByNickname}
                {inquiry.answeredAt ? ` · ${formatDateTime(inquiry.answeredAt)}` : ''}
              </p>
            </Card>
          ) : (
            <Card className="text-subtle text-sm">
              아직 답변이 등록되지 않았어요. 확인 후 답변드릴게요.
            </Card>
          )}
        </section>

        {/* 답변이 달리면 수정·삭제가 막힙니다 (서버도 409 로 거절합니다) */}
        {inquiry.editable && (
          <section className="flex gap-2">
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leftIcon={<Pencil size={17} />}
              onClick={() => navigate(ROUTES.MY_INQUIRY_EDIT(String(inquiry.inquiryId)))}
            >
              수정
            </Button>
            <Button
              variant="danger-ghost"
              size="lg"
              fullWidth
              leftIcon={<Trash2 size={17} />}
              loading={remove.isPending}
              onClick={() =>
                open('common/confirm', {
                  title: '문의를 삭제할까요?',
                  message: '삭제하면 되돌릴 수 없습니다.',
                  confirmText: '삭제',
                  danger: true,
                  onConfirm: () => remove.mutate(inquiry.inquiryId),
                })
              }
            >
              삭제
            </Button>
          </section>
        )}
      </div>
    </>
  );
}
