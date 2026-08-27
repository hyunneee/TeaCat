import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/shared/api';
import { toast } from '@/shared/stores';
import { authApi } from '../api/authApi';
import { useAuthStore } from '../store/authStore';
import type { OtpChannel } from '../model/auth.types';

/**
 * 예매 진입 OTP 인증 (플로우차트: 공연 상세 → OTP 인증 → 구역).
 *
 * 화면은 `code` 를 입력받아 `verify()` 만 부르면 됩니다.
 * 발송/재발송/유효시간 카운트다운/에러 처리는 전부 여기 있습니다.
 */
export function useOtp(scheduleId: string, onVerified: () => void) {
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [remainSeconds, setRemainSeconds] = useState(0);
  /** 목업에서만 내려오는 힌트 코드 */
  const [hint, setHint] = useState<string | undefined>();
  const setOtpVerified = useAuthStore((s) => s.setOtpVerified);

  const send = useMutation({
    mutationFn: (channel: OtpChannel) => authApi.sendOtp(channel),
    onSuccess: (res) => {
      setRemainSeconds(res.expiresInSeconds);
      setHint(res.hint);
      setCode('');
      setInvalid(false);
      toast.success(
        res.channel === 'SMS' ? '문자로 인증번호를 보냈어요.' : '메일로 인증번호를 보냈어요.',
      );
    },
    onError: () => toast.error('인증번호 발송에 실패했어요.'),
  });

  const verify = useMutation({
    mutationFn: (value: string) => authApi.verifyOtp({ code: value, scheduleId }),
    onSuccess: () => {
      // 라우트 가드(RequireOtp)가 이 값을 보고 예매 플로우 진입을 허용합니다.
      setOtpVerified(scheduleId);
      onVerified();
    },
    onError: (error) => {
      setInvalid(true);
      setCode('');
      toast.error(ApiError.isApiError(error) ? error.message : '인증에 실패했어요.');
    },
  });

  // 유효시간 카운트다운
  useEffect(() => {
    if (remainSeconds <= 0) return;
    const id = window.setInterval(() => setRemainSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [remainSeconds]);

  const changeCode = useCallback((value: string) => {
    setCode(value);
    setInvalid(false);
  }, []);

  return {
    code,
    setCode: changeCode,
    invalid,
    hint,
    remainSeconds,
    /** 아직 한 번도 발송하지 않았으면 false */
    sent: send.isSuccess,
    sendOtp: (channel: OtpChannel = 'SMS') => send.mutate(channel),
    isSending: send.isPending,
    verifyOtp: (value: string) => verify.mutate(value),
    isVerifying: verify.isPending,
    expired: send.isSuccess && remainSeconds === 0,
  };
}
