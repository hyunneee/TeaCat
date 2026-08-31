import { useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button, Input, Stepper } from '@/shared/components/ui';
import { BOOKING_STEPS, ROUTES } from '@/shared/constants';
import { useCaptcha } from '@/features/auth';
import { useSchedule } from '@/features/concert';
import { useBookingStore } from '@/features/booking';

/**
 * 예매 진입 관문 — 자동입력 방지 (플로우차트: 공연 상세 → 봇 확인 → 구역).
 * 매크로가 좌석을 쓸어가는 걸 1차로 걸러내는 단계입니다.
 */
export function BookingVerifyPage() {
  const navigate = useNavigate();
  const { scheduleId = '' } = useParams();
  const { data: schedule } = useSchedule(scheduleId);

  // 통과 = 예매 플로우의 시작. 이전에 끝내지 않은 판이 남아 있으면 여기서 버립니다.
  const beginFlow = useBookingStore((s) => s.beginFlow);

  const captcha = useCaptcha(scheduleId, () => {
    beginFlow(scheduleId);
    navigate(ROUTES.BOOKING_SECTION(scheduleId), { replace: true });
  });

  const ready = captcha.answer.length >= captcha.length;

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title="자동입력 방지" showBack />
      <Stepper steps={BOOKING_STEPS} current={0} />

      <div className="flex flex-1 flex-col gap-6 p-4 pt-2">
        <div className="space-y-1.5">
          <h2 className="text-xl font-extrabold">사람인지 확인할게요</h2>
          <p className="text-muted text-sm">
            {schedule?.concertTitle ? `${schedule.concertTitle} 예매를 위해 ` : ''}
            아래 그림에 보이는 글자를 입력해 주세요.
          </p>
        </div>

        <div className="surface shadow-card flex flex-col items-center gap-4 rounded-2xl p-5">
          {captcha.isError ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <ShieldCheck size={40} strokeWidth={1.3} className="text-ink-subtle" />
              <p className="text-muted text-sm">문제를 불러오지 못했어요.</p>
              <Button variant="secondary" onClick={captcha.refresh}>
                다시 시도
              </Button>
            </div>
          ) : (
            <>
              {/* 서버가 그려준 이미지입니다. 정답은 프론트에 내려오지 않습니다. */}
              <div className="surface-2 flex h-24 w-full items-center justify-center overflow-hidden rounded-xl">
                {captcha.imageUrl ? (
                  <img
                    src={captcha.imageUrl}
                    alt="자동입력 방지 문자"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-subtle text-xs">문제를 불러오는 중…</span>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                loading={captcha.isRefreshing}
                leftIcon={<RefreshCw size={14} />}
                onClick={captcha.refresh}
              >
                다른 문제 보기
              </Button>
            </>
          )}
        </div>

        <div className="space-y-3">
          <Input
            value={captcha.answer}
            onChange={(e) => captcha.setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && ready) captcha.verify(captcha.answer);
            }}
            placeholder={`글자 ${captcha.length}개`}
            error={captcha.invalid ? '글자가 맞지 않아요. 새 문제로 다시 시도해 주세요.' : undefined}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={captcha.length}
            className="text-center text-lg font-bold tracking-[0.3em] uppercase"
          />

          <Button
            variant="dark"
            size="lg"
            fullWidth
            loading={captcha.isVerifying}
            disabled={!ready || captcha.isLoading}
            onClick={() => captcha.verify(captcha.answer)}
          >
            확인
          </Button>

          <p className="text-subtle text-center text-xs">
            한 번 통과하면 이 회차 예매가 끝날 때까지 유지됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
