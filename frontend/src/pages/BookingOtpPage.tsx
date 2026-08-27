import { useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, ShieldCheck } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button, OtpInput, Stepper } from '@/shared/components/ui';
import { BOOKING_STEPS, ROUTES } from '@/shared/constants';
import { formatDuration } from '@/shared/lib';
import { useOtp } from '@/features/auth';
import { useSchedule } from '@/features/concert';

/**
 * 예매 진입 관문 — 본인 인증 (플로우차트: 공연 상세 → OTP 인증 → 구역).
 * 매크로/대리 예매를 1차로 걸러내는 단계입니다.
 */
export function BookingOtpPage() {
  const navigate = useNavigate();
  const { scheduleId = '' } = useParams();
  const { data: schedule } = useSchedule(scheduleId);

  const otp = useOtp(scheduleId, () => navigate(ROUTES.BOOKING_SECTION(scheduleId), { replace: true }));

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title="본인 인증" showBack />
      <Stepper steps={BOOKING_STEPS} current={0} />

      <div className="flex flex-1 flex-col gap-6 p-4 pt-2">
        <div className="space-y-1.5">
          <h2 className="text-xl font-extrabold">본인 확인이 필요해요</h2>
          <p className="text-muted text-sm">
            {schedule?.concertTitle ? `${schedule.concertTitle} 예매를 위해 ` : ''}
            등록된 휴대폰으로 인증번호를 보냅니다.
          </p>
        </div>

        {!otp.sent ? (
          <div className="surface flex flex-col items-center gap-4 rounded-xl border p-8">
            <ShieldCheck size={44} strokeWidth={1.3} className="text-brand-500" />
            <p className="text-muted text-center text-sm">
              인증번호는 3분간 유효합니다.
              <br />한 번 인증하면 이 회차 예매가 끝날 때까지 유지됩니다.
            </p>
            <Button
              size="lg"
              fullWidth
              loading={otp.isSending}
              leftIcon={<MessageSquare size={18} />}
              onClick={() => otp.sendOtp('SMS')}
            >
              인증번호 받기
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <OtpInput
              value={otp.code}
              onChange={otp.setCode}
              invalid={otp.invalid}
              disabled={otp.isVerifying || otp.expired}
              onComplete={otp.verifyOtp}
            />

            <p className="text-center text-sm">
              {otp.expired ? (
                <span className="text-danger font-semibold">인증 시간이 만료됐어요</span>
              ) : (
                <span className="text-muted">
                  남은 시간{' '}
                  <b className="text-brand-600 tabular-nums">
                    {formatDuration(otp.remainSeconds)}
                  </b>
                </span>
              )}
            </p>

            {otp.hint && (
              <p className="surface-sunken text-muted rounded-xl p-3 text-center text-xs">
                목업 인증번호 — <b>{otp.hint}</b>
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                fullWidth
                loading={otp.isVerifying}
                disabled={otp.code.length < 6 || otp.expired}
                onClick={() => otp.verifyOtp(otp.code)}
              >
                인증하기
              </Button>
              <Button
                variant="ghost"
                fullWidth
                loading={otp.isSending}
                onClick={() => otp.sendOtp('SMS')}
              >
                인증번호 다시 받기
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
