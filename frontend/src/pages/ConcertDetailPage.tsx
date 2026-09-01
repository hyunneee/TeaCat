import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Clock, MapPin, ShieldAlert, Users } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Card, PosterImage, SectionTitle, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useModal } from '@/app/providers';
import { useAuth } from '@/features/auth';
import { ScheduleList, useConcertDetail } from '@/features/concert';

export function ConcertDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { open } = useModal();
  const { concertId = '' } = useParams();
  const { user, isLoggedIn } = useAuth();
  const { data: concert, isPending, isError } = useConcertDetail(concertId);

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

  return (
    <>
      <Header title={concert.title} showBack />

      <div className="space-y-6 p-4">
        {/* 헤드 — 제목은 포스터 위쪽에, 장소·시간·연령은 **포스터 아래쪽에** 맞춥니다.
            제목 바로 밑에 붙이면 셋이 한 덩어리로 뭉쳐 제목이 묻히고,
            포스터 오른쪽에 빈 공간이 남아 화면이 성의 없어 보입니다. */}
        <section className="flex gap-4">
          <PosterImage
            src={concert.posterUrl}
            seed={concert.posterSeed}
            alt={`${concert.title} 포스터`}
            className="w-28 shrink-0"
          />
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
            <div>
              <h1 className="text-lg leading-tight font-extrabold">{concert.title}</h1>
              <p className="text-muted mt-0.5 text-sm">{concert.artist}</p>
            </div>

            <ul className="text-muted space-y-1 text-[0.8125rem]">
              <li className="flex items-center gap-1.5">
                <MapPin size={13} className="shrink-0" />
                <span className="truncate">{concert.venue?.name}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Clock size={13} className="shrink-0" />
                {concert.runningMinutes}분
              </li>
              <li className="flex items-center gap-1.5">
                <Users size={13} className="shrink-0" />
                {concert.ageLimit}
              </li>
            </ul>
          </div>
        </section>

        {/* 소개 — 회차보다 **먼저** 옵니다.
            "이게 무슨 공연인지" 를 판단하기 전에 날짜를 고르라고 하면
            위아래로 오가며 다시 읽게 됩니다. 읽고 나서 고르는 순서입니다. */}
        <section>
          <SectionTitle>공연 소개</SectionTitle>
          <p className="text-muted text-sm leading-relaxed whitespace-pre-line">
            {concert.description}
          </p>
        </section>

        {/* 회차 */}
        <section>
          <SectionTitle>회차 선택</SectionTitle>
          <ScheduleList
            schedules={concert.schedules}
            onBook={(scheduleId) => startBooking(scheduleId)}
            onWaitlist={(scheduleId) => navigate(ROUTES.RESALE(scheduleId))}
            blocked={
              needsFace
                ? {
                    title: '얼굴 등록이 필요합니다',
                    description:
                      '',
                    actionLabel: '등록하러 가기',
                    onAction: goFaceRegister,
                  }
                : undefined
            }
          />
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
