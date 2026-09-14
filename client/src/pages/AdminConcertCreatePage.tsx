import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { Card, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import {
  arePhotocardDesignsValid,
  ConcertForm,
  EMPTY_CONCERT_CREATE,
  isConcertCreateValid,
  useAreaPricingRows,
  useCreateConcert,
  useStadiumLayouts,
  useStadiums,
  validateConcertCreate,
  type ConcertCreateFormValues,
  type PhotocardDesignForm,
} from '@/features/organizer';

/**
 * 공연 등록 (어드민 콘솔).
 *
 * 폼·검증·구역 가격은 앱 화면(`ConcertCreatePage`)과 **같은 것을 씁니다** — 등록 규칙이
 * 두 벌이 되면 한쪽만 고쳐지는 날이 옵니다. 다른 것은 껍데기(헤더·폭)와 등록 뒤 갈 곳뿐입니다.
 *
 * 등록에 성공하면 목록이 아니라 **그 공연의 관리 화면**으로 보냅니다 —
 * 방금 만든 공연은 회차를 이어서 채우게 됩니다.
 */
const REDIRECT = {
  detail: ROUTES.ADMIN_CONCERT_EDIT,
  edit: ROUTES.ADMIN_CONCERT_EDIT,
  list: ROUTES.ADMIN_CONCERTS,
};

export function AdminConcertCreatePage() {
  const [form, setForm] = useState<ConcertCreateFormValues>(EMPTY_CONCERT_CREATE);
  /* 도안은 공연이 만들어진 뒤에야 보낼 수 있어 폼 값과 따로 들고 있습니다 */
  const [designs, setDesigns] = useState<PhotocardDesignForm[]>([]);
  const [touched, setTouched] = useState<Partial<Record<keyof ConcertCreateFormValues, boolean>>>(
    {},
  );
  const [submitted, setSubmitted] = useState(false);

  const { data: stadiums, isPending, isError } = useStadiums();
  const layouts = useStadiumLayouts(form.stadiumId);
  /* 구역은 공연장이 아니라 고른 **무대 형식**에 딸려 있습니다 */
  const areaPricing = useAreaPricingRows(form.stadiumLayoutId);
  const create = useCreateConcert(REDIRECT);

  /* 공연장을 고르면 기본 형식을 미리 골라 둡니다 — 형식이 하나뿐인 공연장에서 한 번 더 고르게 하지 않습니다.
     공연장을 바꾸면 앞 공연장의 형식은 더 이상 유효하지 않으니 함께 갈아탑니다.
     (앱 화면 ConcertCreatePage 와 같은 규칙입니다) */
  const usableLayoutIds = layouts.usable.map((layout) => layout.layoutId).join(',');
  useEffect(() => {
    if (layouts.usable.length === 0) return;
    const stillValid = layouts.usable.some((l) => String(l.layoutId) === form.stadiumLayoutId);
    if (stillValid) return;
    const preferred = layouts.usable.find((l) => l.isDefault) ?? layouts.usable.at(0);
    if (!preferred) return;
    setForm((prev) => ({ ...prev, stadiumLayoutId: String(preferred.layoutId) }));
    // usable 은 렌더마다 새 배열이라 id 목록으로 비교합니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usableLayoutIds, form.stadiumLayoutId]);

  const errors = validateConcertCreate(form);
  const valid =
    isConcertCreateValid(form) && areaPricing.valid && arePhotocardDesignsValid(designs);

  const visibleErrors = Object.fromEntries(
    Object.entries(errors).filter(
      ([name]) => submitted || touched[name as keyof ConcertCreateFormValues],
    ),
  );

  const handleSubmit = () => {
    setSubmitted(true);
    if (!valid) return;
    create.mutate({ form, areaRows: areaPricing.rows, designs });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          to={ROUTES.ADMIN_CONCERTS}
          className="text-ink-muted hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft size={14} aria-hidden /> 공연 관리
        </Link>
        <h1 className="text-ink mt-1 text-lg font-bold">공연 등록</h1>
        <p className="text-ink-muted text-sm">등록하면 이어서 회차를 추가할 수 있어요.</p>
      </div>

      {isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : isError || !stadiums ? (
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="공연장 목록을 불러오지 못했어요"
            description="공연장이 등록되어 있어야 공연을 만들 수 있어요."
          />
        </Card>
      ) : (
        /* 폼은 모바일 폭에 맞춰 만들어졌습니다. 데스크톱에서 통짜로 늘리면 한 줄이 너무 길어져
           읽기 어려워지므로 읽기 좋은 폭으로 묶어 둡니다 (DESIGN.md 본문 폭). */
        <Card className="max-w-3xl">
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
            layouts={{
              options: layouts.usable,
              loading: layouts.isPending,
              refreshing: layouts.isFetching,
              onRefresh: () => void layouts.refetch(),
            }}
            areaPricing={{
              rows: areaPricing.rows,
              // 구역 에러는 줄 단위라, 제출을 눌렀거나 값을 건드린 뒤에만 보여줍니다
              errors: submitted ? areaPricing.errors : areaPricing.errors.map(() => undefined),
              loading: areaPricing.loading,
              error: areaPricing.error,
              onChange: areaPricing.setRow,
            }}
            designs={designs}
            onDesignsChange={setDesigns}
            showDesignErrors={submitted}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onBlur={(name) => setTouched((prev) => ({ ...prev, [name]: true }))}
            onSubmit={handleSubmit}
          />
        </Card>
      )}
    </div>
  );
}
