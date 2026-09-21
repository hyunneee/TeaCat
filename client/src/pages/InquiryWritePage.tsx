import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { DetailHeader as Header } from '@/shared/components/layout';
import { Loading } from '@/shared/components/common';
import { Button, Card, Input, Segmented, Textarea } from '@/shared/components/ui';
import {
  CONTENT_MAX_LENGTH,
  EMPTY_INQUIRY_FORM,
  INQUIRY_TYPES,
  TITLE_MAX_LENGTH,
  TYPE_DESCRIPTION,
  TYPE_LABEL,
  isInquiryValid,
  useCreateInquiry,
  useInquiry,
  useUpdateInquiry,
  validateInquiry,
  type InquiryWriteRequest,
} from '@/features/inquiry';

const TYPE_OPTIONS = INQUIRY_TYPES.map((type) => ({ value: type, label: TYPE_LABEL[type] }));

/**
 * 문의 작성 · 수정.
 *
 * 경로에 id 가 있으면 수정입니다. 수정은 답변이 달리기 전에만 되고,
 * 서버도 409 로 막습니다 — 화면만 믿지 않습니다.
 */
export function InquiryWritePage() {
  const { inquiryId } = useParams<{ inquiryId: string }>();
  const editingId = inquiryId ? Number(inquiryId) : null;
  const isEditing = editingId !== null;

  const existing = useInquiry(editingId ?? Number.NaN);
  const create = useCreateInquiry();
  const update = useUpdateInquiry(editingId ?? Number.NaN);

  const [form, setForm] = useState<InquiryWriteRequest>(EMPTY_INQUIRY_FORM);
  const [submitted, setSubmitted] = useState(false);

  // 수정이면 기존 내용을 채웁니다
  useEffect(() => {
    const loaded = existing.data;
    if (!isEditing || !loaded) return;

    setForm({ type: loaded.type, title: loaded.title, content: loaded.content });
  }, [isEditing, existing.data]);

  const errors = validateInquiry(form);
  const pending = create.isPending || update.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!isInquiryValid(form)) return;

    if (isEditing) update.mutate(form);
    else create.mutate(form);
  };

  if (isEditing && existing.isPending) return <Loading label="문의를 불러오는 중" />;

  return (
    <>
      <Header title={isEditing ? '문의 수정' : '문의하기'} showBack />

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pt-6"
      >
        <div>
          <Segmented
            options={TYPE_OPTIONS}
            value={form.type}
            onChange={(type) => setForm((prev) => ({ ...prev, type }))}
          />
          <p className="text-subtle mt-2 text-xs">{TYPE_DESCRIPTION[form.type]}</p>
        </div>

        <Input
          label="제목"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="어떤 일이 있었는지 한 줄로 적어주세요"
          maxLength={TITLE_MAX_LENGTH}
          error={submitted ? (errors.title ?? null) : null}
        />

        <Textarea
          label="내용"
          value={form.content}
          onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
          placeholder={
            '언제, 어떤 화면에서, 무엇을 하려다 생긴 일인지 적어주시면 훨씬 빨리 확인할 수 있어요.'
          }
          rows={10}
          maxLength={CONTENT_MAX_LENGTH}
          showCount
          error={submitted ? (errors.content ?? null) : null}
        />

        <Card className="text-subtle text-xs leading-relaxed">
          답변이 등록되면 이 문의는 수정하거나 삭제할 수 없어요. 답변은 문의 내역에서 확인할 수
          있습니다.
        </Card>

        <Button type="submit" variant="dark" size="lg" fullWidth className="mt-1" loading={pending}>
          {isEditing ? '수정 완료' : '문의 남기기'}
        </Button>
      </form>
    </>
  );
}
