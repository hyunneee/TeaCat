import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { EmptyState, Loading } from '@/shared/components/common';
import {
  ConcertForm,
  EMPTY_CONCERT_CREATE,
  isConcertCreateValid,
  useAreaPricingRows,
  useCreateConcert,
  useStadiums,
  validateConcertCreate,
  type ConcertCreateFormValues,
} from '@/features/organizer';

/**
 * 공연 등록 (관리자·주최자).
 *
 * 검증 규칙은 `organizer.types.ts` 와 `areaPricing.ts` 에 있고 이 화면은 그리기만 합니다.
 * 에러는 회원가입과 같은 방식으로 **한 번 건드린 항목부터** 보여줍니다.
 *
 * 구역 등급·가격은 공연장을 고른 뒤 그 공연장의 구역으로 줄이 만들어지고,
 * 등록 요청 뒤 이어서 저장됩니다 (`useCreateConcert` 참고).
 */
export function ConcertCreatePage() {
  const [form, setForm] = useState<ConcertCreateFormValues>(EMPTY_CONCERT_CREATE);
  const [touched, setTouched] = useState<Partial<Record<keyof ConcertCreateFormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: stadiums, isPending, isError } = useStadiums();
  const areaPricing = useAreaPricingRows(form.stadiumId);
  const create = useCreateConcert();

  const errors = validateConcertCreate(form);
  const valid = isConcertCreateValid(form) && areaPricing.valid;

  const visibleErrors = Object.fromEntries(
    Object.entries(errors).filter(([name]) => submitted || touched[name as keyof ConcertCreateFormValues]),
  );

  const handleSubmit = () => {
    setSubmitted(true);
    if (!valid) return;
    create.mutate({ form, areaRows: areaPricing.rows });
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
        submitLabel="등록하기"
        areaPricing={{
          rows: areaPricing.rows,
          // 구역 에러는 줄 단위라, 제출을 눌렀거나 값을 건드린 뒤에만 보여줍니다
          errors: submitted ? areaPricing.errors : areaPricing.errors.map(() => undefined),
          loading: areaPricing.loading,
          error: areaPricing.error,
          onChange: areaPricing.setRow,
        }}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onBlur={(name) => setTouched((prev) => ({ ...prev, [name]: true }))}
        onSubmit={handleSubmit}
      />
    </>
  );
}
