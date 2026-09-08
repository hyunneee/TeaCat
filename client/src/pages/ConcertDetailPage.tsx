import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, MapPin, Pencil, ShieldAlert } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import {
  Card,
  IconButton,
  Lightbox,
  PosterImage,
  SectionTitle,
  Skeleton,
} from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { formatDateTime } from '@/shared/lib';
import { useModal } from '@/app/providers';
import { can, useAuth } from '@/features/auth';
import { ScheduleList, isConcertOwner, posterSeedOf, useConcertDetail } from '@/features/concert';

export function ConcertDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { open } = useModal();
  const { concertId = '' } = useParams();
  const { user, isLoggedIn } = useAuth();
  const { data: concert, isPending, isError } = useConcertDetail(concertId);
  /* 포스터 크게 보기. 목록의 작은 그림만으로는 무슨 공연인지 잘 안 보입니다. */
  const [posterZoomed, setPosterZoomed] = useState(false);

  /** 헤더 오른쪽의 수정 버튼은 **이 공연을 등록한 사람**에게만 보입니다. 서버도 같은 기준으로 거절합니다(PERFORMANCE_020).
      비공개 전환·삭제는 수정 화면 안의 "공연 관리" 에 있습니다 — 상세는 관람객이 보는 화면이라 관리 버튼을 늘리지 않습니다. */
  const canManage = can.manageConcert(user) && !!concert && isConcertOwner(concert, user?.userId);

  /** 로그인은 했는데 얼굴이 없는 상태 — 회차 목록을 덮어 예매를 막습니다. */
  const needsFace = isLoggedIn && !user?.faceRegistered;

  /* 등록을 마치면 **이 공연으로 되돌아오게** 현재 위치를 함께 넘깁니다.
     안 넘기면 useFaceRegistration 의 기본값(마이페이지)으로 가버립니다. */
  const goFaceRegister = () => navigate(ROUTES.FACE_REGISTER, { state: { from: location } });

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
    navigate(ROUTES.BOOKING_VERIFY(scheduleId));
  };

  if (isPending) {
    return (
      <>
        <Header showBack />
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
        <Header showBack />
        <EmptyState icon={ShieldAlert} title="공연 정보를 불러오지 못했어요" />
      </>
    );
  }

  const seed = posterSeedOf(concert);

  return (
    <>
      <Header
        title={concert.title}
        showBack
        right={
          canManage ? (
            <IconButton label="공연 수정" onClick={() => navigate(ROUTES.CONCERT_EDIT(concertId))}>
              <Pencil size={19} />
            </IconButton>
          ) : undefined
        }
      />

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

      <div className="space-y-6 p-4">
        {/* 헤드 — 제목은 포스터 위쪽에, 장소·오픈 시각은 **포스터 아래쪽에** 맞춥니다.
            제목 바로 밑에 붙이면 한 덩어리로 뭉쳐 제목이 묻히고,
            포스터 오른쪽에 빈 공간이 남아 화면이 성의 없어 보입니다. */}
        <section className="flex gap-4">
          {/* 눌러서 크게 봅니다 (포토카드와 같은 방식 — Lightbox).
              포스터는 정보가 아니라 그림이라, 작게 보고 넘어가면 다시 못 봅니다. */}
          <button
            type="button"
            onClick={() => setPosterZoomed(true)}
            aria-label="포스터 크게 보기"
            className="w-28 shrink-0 rounded-xl transition-opacity active:opacity-80"
          >
            <PosterImage src={concert.posterUrl} seed={seed} alt={`${concert.title} 포스터`} />
          </button>
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
            <h1 className="text-lg leading-tight font-extrabold">{concert.title}</h1>

            <ul className="text-muted space-y-1 text-[0.8125rem]">
              <li className="flex items-start gap-1.5">
                <MapPin size={13} className="mt-0.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate">{concert.stadium.name}</span>
                  <span className="text-subtle block truncate text-xs">{concert.stadium.address}</span>
                </span>
              </li>
              <li className="flex items-center gap-1.5">
                <CalendarDays size={13} className="shrink-0" />
                <span className="truncate">티켓 오픈 {formatDateTime(concert.ticketingStartAt)}</span>
              </li>
            </ul>
          </div>
        </section>

        {/* 소개 — 회차보다 **먼저** 옵니다.
            "이게 무슨 공연인지" 를 판단하기 전에 날짜를 고르라고 하면
            위아래로 오가며 다시 읽게 됩니다. 읽고 나서 고르는 순서입니다.
            소개는 글이 아니라 **세로로 긴 이미지 한 장**입니다 (관리자가 올린 상세 이미지). */}
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

        {/* 회차 */}
        <section>
          <SectionTitle>회차 선택</SectionTitle>
          {concert.schedules.length === 0 ? (
            <p className="text-subtle py-6 text-center text-sm">아직 등록된 회차가 없어요.</p>
          ) : (
            <ScheduleList
              schedules={concert.schedules}
              onBook={(scheduleId) => startBooking(scheduleId)}
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

        {/* 안내 */}
        <Card className="flex gap-3">
          <ShieldAlert size={20} className="text-brand-500 shrink-0" />
          <div className="space-y-1 text-xs">
            <p className="text-[0.8125rem] font-bold">암표 방지 정책</p>
            <ul className="text-muted list-disc space-y-0.5 pl-4 leading-relaxed">
              <li>예매 후 다른 사람에게 양도할 수 없습니다.</li>
              <li>결제 시점에 티켓을 받을 사람의 아이디를 지정합니다.</li>
              <li>입장 시 등록된 얼굴로 본인 확인을 합니다.</li>
              <li>취소표는 즉시 판매되지 않고 추첨으로 배정됩니다.</li>
            </ul>
          </div>
        </Card>
      </div>
    </>
  );
}
