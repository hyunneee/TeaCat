import { useCallback, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { authApi, authKeys } from '../api/authApi';
import { useAuthStore } from '../store/authStore';

/**
 * 예매 진입 관문 — **자동입력 방지(캡차)**.
 *
 * 매크로가 예매를 쓸어가는 걸 1차로 막는 단계입니다.
 * 사람 확인이 목적이라 휴대폰 인증번호가 아니라 **그림 속 글자**를 입력받습니다.
 * (문자 발송 비용도 들지 않고, 회차 진입마다 반복해도 부담이 없습니다)
 *
 * 화면은 `answer` 를 받아 `verify()` 만 부르면 됩니다.
 * 문제 발급·재발급·오답 처리는 전부 여기 있습니다.
 *
 * ⚠️ 정답은 **서버만** 압니다. 프론트가 정답을 받아 비교하면
 *    캡차는 아무 의미가 없습니다. 서버는 그림만 내려줍니다.
 */
export function useCaptcha(scheduleId: string, onVerified: () => void) {
  const [answer, setAnswer] = useState('');
  const [invalid, setInvalid] = useState(false);
  const setCaptchaVerified = useAuthStore((s) => s.setCaptchaVerified);

  const challenge = useQuery({
    queryKey: authKeys.captcha(scheduleId),
    queryFn: () => authApi.issueCaptcha(),
    // 문제는 매번 새로 받아야 합니다. 캐시된 문제를 다시 풀게 하면 재사용이 됩니다.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const refresh = useCallback(() => {
    setAnswer('');
    setInvalid(false);
    void queryClient.invalidateQueries({ queryKey: authKeys.captcha(scheduleId) });
  }, [scheduleId]);

  const verify = useMutation({
    mutationFn: (value: string) =>
      authApi.verifyCaptcha({
        challengeId: challenge.data?.challengeId ?? '',
        answer: value,
        scheduleId,
      }),
    onSuccess: () => {
      // 라우트 가드(RequireCaptcha)가 이 값을 보고 예매 플로우 진입을 허용합니다.
      setCaptchaVerified(scheduleId);
      onVerified();
    },
    onError: (error) => {
      setInvalid(true);
      toast.error(ApiError.isApiError(error) ? error.message : '확인에 실패했어요.');
      // 틀린 문제를 계속 풀게 두면 무한 대입이 됩니다. 새 문제를 받습니다.
      refresh();
    },
  });

  const changeAnswer = useCallback((value: string) => {
    // 대소문자를 가리지 않습니다. 좁은 폰에서 대문자 전환은 그 자체가 이탈 요인입니다.
    setAnswer(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
    setInvalid(false);
  }, []);

  return {
    answer,
    setAnswer: changeAnswer,
    invalid,
    /** 서버가 그려준 문제 이미지 (data URL) */
    imageUrl: challenge.data?.imageDataUrl,
    length: challenge.data?.length ?? 5,
    isLoading: challenge.isPending,
    isError: challenge.isError,
    refresh,
    isRefreshing: challenge.isFetching,
    verify: (value: string) => verify.mutate(value),
    isVerifying: verify.isPending,
  };
}
