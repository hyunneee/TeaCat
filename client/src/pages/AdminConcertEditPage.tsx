import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Eye, EyeOff, Tag, Trash2, TriangleAlert } from 'lucide-react';
import { Badge, Button, Card, SectionTitle, Skeleton } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useModal } from '@/app/providers';
import type { ConcertDetail } from '@/features/concert';
import {
  AreaPricingEditor,
  ConcertForm,
  ScheduleEditor,
  concertToForm,
  isConcertCreateValid,
  isConcertFormDirty,
  isTicketingStarted,
  toAreaSaveRequest,
  useAddSchedule,
  useAreaPricingRows,
  useDeleteConcert,
  useDeleteSchedule,
  useMyConcert,
  useSaveAreas,
  useSetVisibility,
  useStadiums,
  useUnsavedChangesGuard,
  useUpdateConcert,
  validateConcertCreate,
  validateNewScheduleDate,
  type ConcertCreateFormValues,
  type StadiumSummary,
} from '@/features/organizer';

/** 등록·수정 뒤 이 화면으로 되돌아옵니다 (앱 화면은 공개 상세로 갑니다) */
const REDIRECT = {
  detail: ROUTES.ADMIN_CONCERT_EDIT,
  edit: ROUTES.ADMIN_CONCERT_EDIT,
  list: ROUTES.ADMIN_CONCERTS,
};

/**
 * 공연 관리 (어드민 콘솔).
 *
 * 앱의 `ConcertEditPage` 와 **같은 조각**(ConcertForm·ScheduleEditor·AreaPricingEditor)을
 * 데스크톱 폭에 맞춰 다시 배치한 화면입니다. 규칙과 검증은 전부 `features/organizer` 에 있고
 * 여기서는 조립만 합니다 (CLAUDE.md 3-6).
 *
 * 네 부분으로 나뉩니다.
 * - **회차**: 추가·삭제가 누르는 즉시 서버에 반영됩니다.
 * - **구역 등급·가격**: 팔 구역과 파는 방식·가격. 이걸 채워야 예매가 열립니다.
 * - **공연 정보**: "저장하기" 를 눌러야 반영되고 **바뀐 필드만** 보냅니다.
 * - **공연 관리**: 공개·비공개 전환과 삭제.
 */
export function AdminConcertEditPage() {
  const { concertId = '' } = useParams();
  const { data: concert, isPending, isError } = useMyConcert(concertId);
  const { data: stadiums, isPending: stadiumsPending, isError: stadiumsError } = useStadiums();

  if (isPending || stadiumsPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !concert || stadiumsError || !stadiums) {
    return (
      <Card>
        <EmptyState
          icon={TriangleAlert}
          title="공연 정보를 불러오지 못했어요"
          description="공연 주최자 계정은 본인이 등록한 공연만 관리할 수 있어요."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to={ROUTES.ADMIN_CONCERTS}
            className="text-ink-muted hover:text-ink inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft size={14} aria-hidden /> 공연 관리
          </Link>
          <h1 className="text-ink mt-1 text-lg font-bold">{concert.title}</h1>
          <p className="text-ink-muted text-sm">{concert.stadium.name}</p>
        </div>
        {concert.hidden && <Badge tone="quiet">비공개</Badge>}
      </div>

      <Card>
        <SectionTitle>회차</SectionTitle>
        <div className="mt-3">
          <Schedules concert={concert} />
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-ink-subtle" aria-hidden />
          <SectionTitle>구역 등급·가격</SectionTitle>
        </div>
        <p className="text-ink-subtle mt-1 text-xs">
          가격이 없는 구역은 예매할 수 없어요. 팔 구역만 켜고 값을 채워 주세요.
        </p>
        <div className="mt-3">
          <AreaPricing concert={concert} />
        </div>
      </Card>

      <Card className="max-w-3xl">
        <SectionTitle>공연 정보</SectionTitle>
        <div className="mt-3">
          <EditForm concert={concert} stadiums={stadiums} />
        </div>
      </Card>

      <Card>
        <SectionTitle>공연 관리</SectionTitle>
        <div className="mt-3">
          <Management concert={concert} />
        </div>
      </Card>
    </div>
  );
}

/* 회차 추가·삭제. 삭제는 되돌릴 수 없어 붉은 확인 모달을 거칩니다 (CLAUDE.md 4-7). */
function Schedules({ concert }: { concert: ConcertDetail }) {
  const { open } = useModal();
  const add = useAddSchedule(String(concert.concertId));
  const remove = useDeleteSchedule();

  const existingDates = concert.schedules.map((s) => s.performanceDate);

  const confirmRemove = (scheduleId: string) => {
    const target = concert.schedules.find((s) => String(s.scheduleId) === scheduleId);
    open('common/confirm', {
      title: `${target?.performanceNum ?? ''}회차를 삭제할까요?`,
      message:
        '이 회차의 좌석 설정이 함께 지워지고 되돌릴 수 없습니다. 예매 이력이 있는 회차는 삭제되지 않아요.',
      confirmText: '삭제',
      danger: true,
      onConfirm: () => remove.mutate(scheduleId),
    });
  };

  return (
    <ScheduleEditor
      schedules={concert.schedules}
      validate={(date) => validateNewScheduleDate(date, concert, existingDates)}
      onAdd={(date) => add.mutate(date)}
      onRemove={confirmRemove}
      adding={add.isPending}
      removingId={remove.isPending ? (remove.variables ?? null) : null}
    />
  );
}

/**
 * 구역별 등급·가격. PUT 이라 목록 전체를 한 번에 저장하므로 저장 버튼을 둡니다.
 * 이미 팔린 구역은 끌 수 없고 판매량보다 적게 줄일 수 없습니다 — 줄 검증과 서버(PERFORMANCE_012)가 함께 막습니다.
 */
function AreaPricing({ concert }: { concert: ConcertDetail }) {
  const { open } = useModal();
  /* 구역은 공연장이 아니라 이 공연이 쓰는 **무대 형식**에 딸려 있습니다.
     공연장 기준으로 불러오면 기본 배치의 구역이 와서, 다른 형식으로 등록한 공연은
     저장할 때마다 거절됩니다 (PERFORMANCE_010). */
  const pricing = useAreaPricingRows(String(concert.layout.layoutId), concert.areas);
  const save = useSaveAreas(String(concert.concertId));

  const body = toAreaSaveRequest(pricing.rows);

  const confirmSave = () => {
    if (!pricing.valid || !body) return;
    open('common/confirm', {
      title: '구역 등급·가격을 저장할까요?',
      message:
        '끈 구역은 이 공연에서 판매하지 않는 것으로 처리됩니다. 예매 화면의 가격이 바로 바뀝니다.',
      confirmText: '저장',
      onConfirm: () => save.mutate(body),
    });
  };

  if (pricing.loading) return <Loading label="구역을 불러오는 중" className="min-h-0 py-6" />;
  if (pricing.error) {
    return <p className="text-danger py-3 text-center text-sm">구역 목록을 불러오지 못했어요.</p>;
  }

  return (
    <div className="space-y-3">
      <AreaPricingEditor rows={pricing.rows} errors={pricing.errors} onChange={pricing.setRow} />
      {pricing.rows.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="dark"
            size="md"
            loading={save.isPending}
            disabled={!pricing.valid || !body}
            onClick={confirmSave}
          >
            구역 설정 저장
          </Button>
        </div>
      )}
      {!body && pricing.rows.length > 0 && (
        <p className="text-subtle text-right text-xs">
          판매할 구역을 하나 이상 켜야 저장할 수 있어요.
        </p>
      )}
    </div>
  );
}

/* 폼 상태는 공연 데이터가 도착한 뒤에 만들어야 초깃값이 채워집니다.
   그래서 로딩 분기 아래에 별도 컴포넌트로 둡니다 (useState 초깃값은 첫 렌더에만 쓰이기 때문). */
function EditForm({ concert, stadiums }: { concert: ConcertDetail; stadiums: StadiumSummary[] }) {
  const { open } = useModal();
  const [form, setForm] = useState<ConcertCreateFormValues>(() => concertToForm(concert));
  const [touched, setTouched] = useState<Partial<Record<keyof ConcertCreateFormValues, boolean>>>(
    {},
  );
  const [submitted, setSubmitted] = useState(false);

  // 수정은 회차를 다루지 않으므로 회차 검사를 건너뜁니다
  const errors = validateConcertCreate(form, 'edit');
  const valid = isConcertCreateValid(form, 'edit');
  const locked = isTicketingStarted(concert);
  const dirty = isConcertFormDirty(form, concert);

  /* 저장하지 않고 떠나면 묻습니다. 저장에 성공해 떠날 때는 훅이 먼저 release() 를 불러 막지 않습니다. */
  const guard = useUnsavedChangesGuard(dirty);
  const update = useUpdateConcert(String(concert.concertId), guard.release, REDIRECT);

  const visibleErrors = Object.fromEntries(
    Object.entries(errors).filter(
      ([name]) => submitted || touched[name as keyof ConcertCreateFormValues],
    ),
  );

  const handleSubmit = () => {
    setSubmitted(true);
    if (!valid) return;
    if (!dirty) {
      update.mutate({ form, original: concert });
      return;
    }
    open('common/confirm', {
      title: '변경 내용을 저장할까요?',
      message: locked
        ? '제목과 이미지 변경이 공연에 바로 반영됩니다.'
        : '공연장·티켓팅 시각·노출 시작일을 바꿨다면 예매자가 보는 정보가 함께 바뀝니다.',
      confirmText: '저장',
      onConfirm: () => update.mutate({ form, original: concert }),
    });
  };

  return (
    <ConcertForm
      form={form}
      errors={visibleErrors}
      stadiums={stadiums}
      submitting={update.isPending}
      disabled={submitted && !valid}
      submitLabel="저장하기"
      editing
      lockedReason={
        locked
          ? '티켓팅이 시작된 공연이에요. 예매자가 보고 결정한 공연장·티켓팅 시각·노출 시작일은 바꿀 수 없고, 제목과 이미지만 수정할 수 있어요.'
          : undefined
      }
      onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
      onBlur={(name) => setTouched((prev) => ({ ...prev, [name]: true }))}
      onSubmit={handleSubmit}
    />
  );
}

/**
 * 공개·비공개 전환과 삭제.
 *
 * 비공개는 되돌릴 수 있어 일반 버튼 + 일반 확인 모달이고, 삭제는 되돌릴 수 없어
 * 붉은 버튼 + 붉은 확인 모달입니다 (CLAUDE.md 4-7). 둘이 같아 보이면 사고가 납니다.
 */
function Management({ concert }: { concert: ConcertDetail }) {
  const { open } = useModal();
  const id = String(concert.concertId);
  const visibility = useSetVisibility(id);
  const remove = useDeleteConcert(REDIRECT);

  const confirmVisibility = () => {
    const toHidden = !concert.hidden;
    open('common/confirm', {
      title: toHidden ? '공연을 비공개로 바꿀까요?' : '공연을 다시 공개할까요?',
      message: toHidden
        ? '목록과 상세에서 보이지 않게 됩니다. 데이터는 그대로 남아 언제든 다시 공개할 수 있어요.'
        : '목록과 상세에 다시 보이고 예매도 가능해집니다.',
      confirmText: toHidden ? '비공개로 바꾸기' : '공개하기',
      onConfirm: () => visibility.mutate(!toHidden),
    });
  };

  const confirmDelete = () =>
    open('common/confirm', {
      title: '이 공연을 삭제할까요?',
      message:
        '회차·구역·좌석 설정과 이미지가 함께 지워지고 되돌릴 수 없습니다. 예매 이력이 있는 공연은 삭제되지 않으니, 그럴 땐 비공개로 감춰 주세요.',
      confirmText: '삭제',
      danger: true,
      onConfirm: () => remove.mutate(id),
    });

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-ink text-sm font-semibold">
          {concert.hidden ? '지금 비공개 상태예요' : '지금 공개 상태예요'}
        </p>
        <p className="text-ink-subtle mt-0.5 flex items-center gap-1.5 text-xs">
          <CalendarDays size={12} aria-hidden />
          {concert.hidden
            ? '목록과 상세에서 보이지 않아요. 정보를 고친 뒤 다시 공개하세요.'
            : '정보가 틀렸거나 잠깐 내려야 하면 비공개로 감출 수 있어요. 되돌릴 수 있습니다.'}
        </p>
      </div>

      <Button
        variant="soft"
        size="md"
        leftIcon={concert.hidden ? <Eye size={16} /> : <EyeOff size={16} />}
        loading={visibility.isPending}
        onClick={confirmVisibility}
      >
        {concert.hidden ? '공개하기' : '비공개'}
      </Button>

      <Button
        variant="danger-ghost"
        size="md"
        leftIcon={<Trash2 size={16} />}
        loading={remove.isPending}
        onClick={confirmDelete}
      >
        공연 삭제
      </Button>
    </div>
  );
}
