import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { EmptyState, Loading } from '@/shared/components/common';
import {
  arePhotocardDesignsValid,
  ConcertForm,
  EMPTY_CONCERT_CREATE,
  isConcertCreateValid,
  useCreateConcert,
  useStadiums,
  validateConcertCreate,
  type ConcertCreateFormValues,
  type PhotocardDesignForm,
} from '@/features/organizer';

/**
 * 공연 등록 (관리자).
 *
 * 검증 규칙은 `organizer.types.ts` 에 있고 이 화면은 그리기만 합니다.
 * 에러는 회원가입과 같은 방식으로 **한 번 건드린 항목부터** 보여줍니다.
 */
export function ConcertCreatePage() {
  const [form, setForm] = useState<ConcertCreateFormValues>(EMPTY_CONCERT_CREATE);
  /* 도안은 공연이 만들어진 뒤에야 보낼 수 있어 폼 값과 따로 들고 있습니다 */
  const [designs, setDesigns] = useState<PhotocardDesignForm[]>([]);
  const [touched, setTouched] = useState<Partial<Record<keyof ConcertCreateFormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: stadiums, isPending, isError } = useStadiums();
  const create = useCreateConcert();

  const errors = validateConcertCreate(form);
  const valid = isConcertCreateValid(form) && arePhotocardDesignsValid(designs);

  const visibleErrors = Object.fromEntries(
    Object.entries(errors).filter(([name]) => submitted || touched[name as keyof ConcertCreateFormValues]),
  );

  const handleSubmit = () => {
    setSubmitted(true);
    if (!valid) return;
    create.mutate({ form, designs });
  };

  if (isPending) {
    return (
      <>
        <Header title="공연 등록" showBack />
        <Loading label="공연장 목록을 불러오는 중" />
      </>
    );
  }

  if (isError || !stadiums) {
    return (
      <>
        <Header title="공연 등록" showBack />
        <EmptyState
          icon={TriangleAlert}
          title="공연장 목록을 불러오지 못했어요"
          description="공연장이 등록되어 있어야 공연을 만들 수 있어요."
        />
      </>
    );
  }

  return (
    <>
      <Header title="공연 등록" showBack />
      <ConcertForm
        form={form}
        errors={visibleErrors}
        stadiums={stadiums}
        submitting={create.isPending}
        disabled={submitted && !valid}
        submitLabel={
          create.designProgress
            ? `포토카드 올리는 중 ${create.designProgress.done + 1}/${create.designProgress.total}`
            : '등록하기'
        }
        designs={designs}
        onDesignsChange={setDesigns}
        showDesignErrors={submitted}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onBlur={(name) => setTouched((prev) => ({ ...prev, [name]: true }))}
        onSubmit={handleSubmit}
      />
    </>
  );
}
