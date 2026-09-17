import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/shared/api';
import { env } from '@/shared/config';
import { trackGaEvent } from '@/shared/lib';
import { toast } from '@/shared/stores';
import { checkInApi } from '../api/checkInApi';
import type { CheckInResult, CheckInSource, CheckInTicket } from '../model/checkIn.types';

/**
 * 게이트 검표 한 사람 분.
 *
 * ── 단계 ───────────────────────────────────────────────────
 *   scan   QR 을 찍거나 번호를 넣어 **표를 확인**합니다 (입장 처리 아님)
 *   face   얼굴을 찍어 대조하고, 통과하면 서버가 **입장 처리**합니다
 *   done   결과를 보여주고 다음 사람으로 넘어갑니다
 *
 * 🔴 표가 먼저입니다. 취소된 표·다른 회차·이미 입장한 표는 **얼굴을 찍기 전에** 걸러집니다 —
 * 통과할 수 없는 사람의 생체정보를 굳이 받지 않습니다 (서버 `TicketCheckInService` 와 한 쌍).
 */
export type CheckInStep = 'scan' | 'face' | 'done';

export interface CheckIn {
  step: CheckInStep;
  /** 확인된 표. 아직 안 찍었으면 null */
  ticket: CheckInTicket | null;
  result: CheckInResult | null;
  scanning: boolean;
  verifying: boolean;
  /** 표를 확인합니다 (QR 문자열 또는 티켓 번호) */
  scan: (source: CheckInSource) => void;
  /** 지금 찍은 얼굴로 대조합니다 */
  verify: (embedding: Float32Array) => void;
  /** 다음 사람 — 처음으로 되돌립니다 */
  reset: () => void;
}

export function useCheckIn(performanceDetailId: number | null): CheckIn {
  const [step, setStep] = useState<CheckInStep>('scan');
  const [source, setSource] = useState<CheckInSource | null>(null);
  const [ticket, setTicket] = useState<CheckInTicket | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);

  const scanMutation = useMutation({
    mutationFn: (next: CheckInSource) => {
      if (performanceDetailId === null) throw new Error('회차를 먼저 고르세요.');
      return checkInApi.scan(next, performanceDetailId);
    },
    /* 게이트에서 같은 QR 이 여러 프레임 잡히므로 재시도까지 하면 요청이 겹칩니다 */
    retry: false,
    onSuccess: (found, next) => {
      setSource(next);
      setTicket(found);
      setStep('face');
    },
    onError: (error) =>
      toast.error(ApiError.isApiError(error) ? error.message : '티켓을 확인하지 못했어요.'),
  });

  const verifyMutation = useMutation({
    mutationFn: (embedding: Float32Array) => {
      if (performanceDetailId === null || source === null) {
        throw new Error('확인할 티켓이 없습니다.');
      }
      return checkInApi.verify(
        source,
        performanceDetailId,
        // JSON 으로 나가야 하므로 일반 배열로. 128개면 약 1.5KB 입니다
        Array.from(embedding),
        env.face.modelVersion,
      );
    },
    retry: false,
    onSuccess: (verified) => {
      setResult(verified);
      setStep('done');
      /* 🔴 `match: false` 는 에러가 아니라 정상 응답입니다 — onSuccess 에서 갈라야
         "게이트에서 몇 %가 떨어지나" 가 잡힙니다. onError 만 세면 통과한 것처럼 보입니다.
         🔴 유사도·임계값은 보내지 않습니다. 생체 판정 점수라 GA 에 남길 값이 아닙니다. */
      trackGaEvent(verified.match ? 'face_verify_success' : 'face_verify_fail', {
        ...(verified.match ? {} : { fail_reason: 'NO_MATCH' }),
      });
    },
    onError: (error) => {
      trackGaEvent('face_verify_fail', {
        fail_reason: ApiError.isApiError(error) ? error.code : 'NETWORK',
      });
      toast.error(ApiError.isApiError(error) ? error.message : '본인 확인에 실패했어요.');
    },
  });

  const reset = useCallback(() => {
    setStep('scan');
    setSource(null);
    setTicket(null);
    setResult(null);
    scanMutation.reset();
    verifyMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutation 객체는 렌더마다 새로 만들어집니다
  }, []);

  return {
    step,
    ticket,
    result,
    scanning: scanMutation.isPending,
    verifying: verifyMutation.isPending,
    scan: scanMutation.mutate,
    verify: verifyMutation.mutate,
    reset,
  };
}
