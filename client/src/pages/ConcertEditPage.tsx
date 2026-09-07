import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { SectionTitle } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { useModal } from '@/app/providers';
import { useConcertDetail, type ConcertDetail } from '@/features/concert';
import {
  ConcertForm,
  ScheduleEditor,
  concertToForm,
  isConcertCreateValid,
  isConcertFormDirty,
  isTicketingStarted,
  useAddSchedule,
  useDeleteSchedule,
  useStadiums,
  useUnsavedChangesGuard,
  useUpdateConcert,
  validateConcertCreate,
  validateNewScheduleDate,
  type ConcertCreateFormValues,
  type StadiumSummary,
} from '@/features/organizer';

/**
 * 공연 수정 (관리자).
 *
 * 두 부분으로 나뉩니다.
 * - **회차**: 추가·삭제가 누르는 즉시 서버에 반영됩니다.
 * - **공연 정보**: 폼을 고쳐 "저장하기" 를 눌러야 반영되고, **바뀐 필드만** 보냅니다.
 *   저장 전에 한 번 확인하고, 저장하지 않고 나가려 하면 경고합니다.
 *   티켓팅이 시작된 공연은 제목·이미지만 바꿀 수 있습니다 (API-262 규칙, 폼이 나머지를 잠급니다).
 */
export function ConcertEditPage() {
  const { concertId = '' } = useParams();
  const { data: concert, isPending, isError } = useConcertDetail(concertId);
  const { data: stadiums, isPending: stadiumsPending, isError: stadiumsError } = useStadiums();

  if (isPending || stadiumsPending) {
    return (
      <>
        <Header title="공연 수정" showBack />
        <Loading label="공연 정보를 불러오는 중" />
      </>
    );
  }

  if (isError || !concert || stadiumsError || !stadiums) {
    return (
      <>
        <Header title="공연 수정" showBack />
        <EmptyState icon={TriangleAlert} title="공연 정보를 불러오지 못했어요" />
      </>
    );
  }

  return (
    <>
      <Header title="공연 수정" showBack />

      <section className="p-4 pb-2">
        <SectionTitle>회차</SectionTitle>
        <Schedules concert={concert} />
      </section>

      <section className="pt-2">
        <div className="px-4">
          <SectionTitle>공연 정보</SectionTitle>
        </div>
        <EditForm concert={concert} stadiums={stadiums} />
      </section>
    </>
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
      message: '이 회차의 좌석 설정이 함께 지워지고 되돌릴 수 없습니다. 예매 이력이 있는 회차는 삭제되지 않아요.',
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

/* 폼 상태는 공연 데이터가 도착한 뒤에 만들어야 초깃값이 채워집니다.
   그래서 로딩 분기 아래에 별도 컴포넌트로 둡니다 (useState 초깃값은 첫 렌더에만 쓰이기 때문). */
function EditForm({ concert, stadiums }: { concert: ConcertDetail; stadiums: StadiumSummary[] }) {
  const { open } = useModal();
  const [form, setForm] = useState<ConcertCreateFormValues>(() => concertToForm(concert));
  const [touched, setTouched] = useState<Partial<Record<keyof ConcertCreateFormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  // 수정은 회차를 다루지 않으므로 회차 검사를 건너뜁니다
  const errors = validateConcertCreate(form, 'edit');
  const valid = isConcertCreateValid(form, 'edit');
  const locked = isTicketingStarted(concert);
  const dirty = isConcertFormDirty(form, concert);

  /* 저장하지 않고 떠나면 묻습니다. 저장에 성공해 떠날 때는 훅이 먼저 release() 를 불러 막지 않습니다. */
  const guard = useUnsavedChangesGuard(dirty);
  const update = useUpdateConcert(String(concert.concertId), guard.release);

  const visibleErrors = Object.fromEntries(
    Object.entries(errors).filter(([name]) => submitted || touched[name as keyof ConcertCreateFormValues]),
  );

  /* 저장은 한 번 확인합니다. 회차 추가·삭제는 즉시 반영되는데 공연 정보만 버튼을 눌러야 바뀌는 구조라,
     "지금 이 버튼이 서버에 쓰는 것" 을 확인 창으로 분명히 해둡니다. */
  const handleSubmit = () => {
    setSubmitted(true);
    if (!valid) return;
    if (!dirty) {
      update.mutate({ form, original: concert }); // 바뀐 게 없다는 안내만 뜨고 상세로 돌아갑니다
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
