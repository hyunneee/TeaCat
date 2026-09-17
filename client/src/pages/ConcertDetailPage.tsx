import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, MapPin, ShieldAlert } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Card, Lightbox, PosterImage, SectionTitle, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { FEATURE, ROUTES } from '@/shared/constants';
import { formatDateTime } from '@/shared/lib';
import { useModal } from '@/app/providers';
import { can, useAuth } from '@/features/auth';
import { ScheduleList, posterSeedOf, useConcertDetail, useStartBooking } from '@/features/concert';

export function ConcertDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { open } = useModal();
  const { concertId = '' } = useParams();
  const { user, isLoggedIn } = useAuth();
  /* `/concerts/무엇이든` 이 전부 여기로 들어옵니다. 숫자가 아니면 공연 ID 가 아니라
     없는 주소입니다 — 예전 `/concerts/new`(등록 화면, 지금은 어드민으로 옮김) 같은
     오래된 링크가 여기로 떨어집니다. 서버에 물어봐야 500 만 받으므로 묻지 않습니다. */
  const isConcertId = /^\d+$/.test(concertId);
  const { data: concert, isPending, isError } = useConcertDetail(isConcertId ? concertId : '');
  /* 포스터 크게 보기. 목록의 작은 그림만으로는 무슨 공연인지 잘 안 보입니다. */
  const [posterZoomed, setPosterZoomed] = useState(false);

  /**
   * 로그인은 했는데 얼굴이 없는 상태 — 회차 목록을 덮어 예매를 막습니다.
   *
   * 판단은 `can.useTicket` 하나에 맡깁니다. 얼굴을 닫아 둔 배포에서는 늘 true 라
   * 회차를 덮던 안내와 예매 전 모달이 **함께** 사라집니다.
   */
  const needsFace = isLoggedIn && !can.useTicket(user);

  /* 등록을 마치면 **이 공연으로 되돌아오게** 현재 위치를 함께 넘깁니다.
     안 넘기면 useFaceRegistration 의 기본값(마이페이지)으로 가버립니다. */
  const goFaceRegister = () => navigate(ROUTES.FACE_REGISTER, { state: { from: location } });

  /* 오픈 전 회차도 버튼이 눌립니다. 열렸는지는 **누른 그 순간 서버에** 물어봅니다
     (useStartBooking) — 새로고침해야 버튼이 나타나던 문제를 없애면서, 판단은 서버에 둡니다. */
  const booking = useStartBooking();

  /* 덮개를 지우고 눌러도 여기서 다시 막습니다.
     화면 표시(덮개) → 버튼 disabled → 이 핸들러 → 라우트 가드, 네 겹입니다. */
  const startBooking = (scheduleId: string) => {
    if (needsFace) {
      open('common/confirm', {
        title: '얼굴 등록이 필요해요',
        message:
          '예매하려면 마이페이지에서 얼굴을 한 번 등록해야 합니다. 등록해 두면 예매한 티켓에 자동으로 매칭돼요.',
        confirmText: '등록하러 가기',
        onConfirm: goFaceRegister,
      });
      return;
    }
    booking.start(scheduleId, () => navigate(ROUTES.BOOKING_VERIFY(scheduleId)));
  };

  /* 쿼리를 끄면 `isPending` 이 계속 true 라 로딩 화면에서 멈춥니다. 로딩 분기보다 먼저 빠져나옵니다 */
  if (!isConcertId) {
    return (
      <>
        <Header showBack className="lg:hidden" />
        <EmptyState
          mood="sad"
          title="페이지를 찾을 수 없어요"
          description="주소가 바뀌었거나 삭제된 페이지입니다."
        />
      </>
    );
  }

  if (isPending) {
    return (
      <>
        <Header showBack className="lg:hidden" />
        <div className="space-y-4 p-4">
          <Skeleton className="aspect-[3/4] w-40" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </>
    );
  }

  if (isError || !concert) {
    return (
      <>
        <Header showBack className="lg:hidden" />
        <EmptyState icon={ShieldAlert} title="공연 정보를 불러오지 못했어요" />
      </>
    );
  }

  const seed = posterSeedOf(concert);

  return (
    <>
      {/* 🔴 수정 버튼을 두지 않습니다. 공연 관리는 어드민 콘솔(`/admin`)로 옮기기로 했습니다 —
          여기는 관람객이 보는 화면입니다. 수정 화면(`/concerts/:id/edit`)과 라우트 가드는
          그대로 살아 있으니, 어드민에 "공연 관리" 메뉴가 생기면 거기서 이어 붙이면 됩니다. */}
      <Header title={concert.title} showBack className="lg:hidden" />

      <Lightbox
        open={posterZoomed}
        onClose={() => setPosterZoomed(false)}
        label={`${concert.title} 포스터 크게 보기`}
        caption={
          <>
            <p className="text-base font-bold text-white">{concert.title}</p>
            <p className="text-sm text-white/60">{concert.stadium.name}</p>
          </>
        }
      >
        <PosterImage src={concert.posterUrl} seed={seed} alt={`${concert.title} 포스터`} />
      </Lightbox>

      {/* 넓은 화면에서도 본문을 1024px 까지 늘리지는 않습니다 — 회차 한 줄과
          "티켓 오픈" 한 줄이 양 끝으로 벌어져 왼쪽 글자와 오른쪽 값이 따로 놉니다.
          읽는 폭(768px)으로 묶고 가운데에 둡니다. */}
      <div className="space-y-6 p-4 lg:mx-auto lg:max-w-3xl lg:px-0 lg:pt-4">
        {/* 헤드 — 제목은 포스터 위쪽에, 장소는 **포스터 아래쪽에** 맞춥니다.
            제목 바로 밑에 붙이면 한 덩어리로 뭉쳐 제목이 묻히고,
            포스터 오른쪽에 빈 공간이 남아 화면이 성의 없어 보입니다.
            오픈 시각은 좁아서 잘리던 탓에 아래 한 줄로 뺐습니다. */}
        <section className="flex gap-4">
          {/* 눌러서 크게 봅니다 (포토카드와 같은 방식 — Lightbox).
              포스터는 정보가 아니라 그림이라, 작게 보고 넘어가면 다시 못 봅니다. */}
          <button
            type="button"
            onClick={() => setPosterZoomed(true)}
            aria-label="포스터 크게 보기"
            className="w-28 shrink-0 rounded-xl transition-opacity active:opacity-80 lg:w-40"
          >
            <PosterImage src={concert.posterUrl} seed={seed} alt={`${concert.title} 포스터`} />
          </button>
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
            <h1 className="text-lg leading-tight font-extrabold lg:text-2xl">{concert.title}</h1>

            {/* 🔴 말줄임을 쓰지 않습니다. 공연장 이름과 주소는 **찾아가기 위한 정보**라
                뒤가 잘리면 쓸모가 없습니다("올림픽공원 체조경기…", "서울 송파구 올림…").
                한 줄에 안 들어가면 줄을 바꿔 다 보여줍니다. */}
            <p className="text-muted flex items-start gap-1.5 text-[0.8125rem]">
              <MapPin size={13} className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                <span className="block break-keep">{concert.stadium.name}</span>
                <span className="text-subtle block text-xs break-keep">
                  {concert.stadium.address}
                </span>
              </span>
            </p>
          </div>
        </section>

        {/* 티켓 오픈 시각은 **한 줄을 통째로** 씁니다.
            포스터 옆 칸은 176px 밖에 안 돼서 날짜가 딱 맞게 들어가 있었고,
            하루만 두 자리가 되면(12. 1. → 12. 12.) 바로 잘렸습니다.
            이 화면에서 가장 중요한 정보라 잘려서는 안 됩니다. */}
        <section className="surface-2 flex items-center gap-2 rounded-xl px-3.5 py-3">
          <CalendarDays size={15} className="text-ink-muted shrink-0" />
          <span className="text-subtle text-[0.8125rem]">티켓 오픈</span>
          <time
            dateTime={concert.ticketingStartAt}
            className="ml-auto text-right text-[0.8125rem] font-bold"
          >
            {formatDateTime(concert.ticketingStartAt)}
          </time>
        </section>

        {/* 회차 — 소개보다 **먼저** 옵니다.
            🔴 예전에는 소개가 위였습니다("읽고 나서 고르는 순서"). 그런데 소개는 글이
               아니라 **세로로 긴 이미지 한 장**이라, 상세 이미지를 올린 공연에서는
               예매 버튼이 화면 몇 개 아래로 밀려났습니다. 이 화면에 오는 사람 대부분은
               이미 무슨 공연인지 알고 예매하러 옵니다 — 그 사람들에게 스크롤을
               강요하는 대가가, 읽고 고르는 순서로 얻는 것보다 큽니다.
               소개를 읽고 싶은 사람은 아래로 내리면 되고, 내려간 자리에서 되돌아올
               필요는 없습니다(회차는 이미 지나온 자리입니다). */}
        <section>
          <SectionTitle>회차 선택</SectionTitle>
          {concert.schedules.length === 0 ? (
            <p className="text-subtle py-6 text-center text-sm">아직 등록된 회차가 없어요.</p>
          ) : (
            <ScheduleList
              schedules={concert.schedules}
              onBook={(scheduleId) => startBooking(scheduleId)}
              checkingId={booking.checkingId}
              onWaitlist={(scheduleId) => navigate(ROUTES.RESALE(scheduleId))}
              blocked={
                needsFace
                  ? {
                      title: '얼굴 등록이 필요해요',
                      description:
                        '마이페이지에서 한 번만 등록하면 예매한 티켓에 자동으로 매칭돼요.',
                      actionLabel: '등록하러 가기',
                      onAction: goFaceRegister,
                    }
                  : undefined
              }
            />
          )}
        </section>

        {/* 소개 — 관리자가 올린 **세로로 긴 이미지 한 장**입니다 (글이 아닙니다) */}
        {concert.detailImageUrl && (
          <section>
            <SectionTitle>공연 소개</SectionTitle>
            <img
              src={concert.detailImageUrl}
              alt={`${concert.title} 상세 안내`}
              loading="lazy"
              draggable={false}
              className="border-line w-full rounded-xl border"
            />
          </section>
        )}

        {/* 안내 */}
        <Card className="flex gap-3">
          <ShieldAlert size={20} className="text-brand-500 shrink-0" />
          <div className="space-y-1 text-xs">
            <p className="text-[0.8125rem] font-bold">암표 방지 정책</p>
            <ul className="text-muted list-disc space-y-0.5 pl-4 leading-relaxed">
              <li>예매 후 다른 사람에게 양도할 수 없습니다.</li>
              <li>결제 시점에 티켓을 받을 사람의 아이디를 지정합니다.</li>
              {/* 얼굴을 닫아 둔 배포에서는 이 줄을 뺍니다 — 하지 않는 확인을
                  하겠다고 적어 두면 안내가 사실과 달라집니다 */}
              {FEATURE.face && <li>입장 시 등록된 얼굴로 본인 확인을 합니다.</li>}
              <li>취소표는 즉시 판매되지 않고 추첨으로 배정됩니다.</li>
            </ul>
          </div>
        </Card>
      </div>
    </>
  );
}
