import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, newIdempotencyKey, queryClient } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { stickerApi, stickerKeys } from '../api/stickerApi';
import { blobToBase64, exportDoodlePng } from '../model/sticker.model';
import { STICKER_ERROR, type Stroke, type StickerJob } from '../model/sticker.types';

/**
 * 작업이 끝나기를 기다리는 동안 다시 물어보는 간격.
 * 포카 발행 대기(`usePhotocardDetail`)와 같은 패턴 — DONE/FAILED 가 되면 **스스로 멈춥니다.**
 * 생성은 6초 안팎이라 2초면 두세 번 안에 끝납니다.
 */
const JOB_POLL_MS = 2000;

const isWaiting = (job?: StickerJob) => job?.status === 'PENDING' || job?.status === 'RUNNING';

/** 작업 상태 폴링. jobId 가 없으면 부르지 않습니다 */
export function useStickerJob(jobId: number | null) {
  return useQuery({
    queryKey: stickerKeys.job(jobId ?? 0),
    queryFn: () => stickerApi.job(jobId!),
    enabled: jobId !== null,
    staleTime: STALE_TIME.REALTIME,
    refetchInterval: (query) => (isWaiting(query.state.data) ? JOB_POLL_MS : false),
  });
}

export function useStickerQuota() {
  return useQuery({
    queryKey: stickerKeys.quota(),
    queryFn: stickerApi.quota,
    staleTime: STALE_TIME.SHORT,
  });
}

export function useMyStickers() {
  return useQuery({
    queryKey: stickerKeys.mine(),
    queryFn: stickerApi.mine,
    staleTime: STALE_TIME.SHORT,
  });
}

/** 삭제 — 되돌릴 수 없는 동작이라 화면이 확인 모달을 먼저 띄웁니다 (CLAUDE.md 4-7) */
export function useDeleteSticker() {
  return useMutation({
    mutationFn: stickerApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stickerKeys.mine() });
      toast.success('스티커를 지웠어요');
    },
    onError: () => toast.error('지우지 못했어요. 잠시 후 다시 시도해 주세요'),
  });
}

/**
 * 만들기 흐름 하나로 묶은 훅 — 페이지는 이것만 부릅니다.
 *
 *   낙서(획) → 1024 PNG → base64 → POST /stickers → jobId → 폴링 → DONE(스티커) | FAILED
 *
 * - **멱등키는 누를 때마다 새로** 만듭니다. "다시 만들기" 는 새 작업이라 새 키가 맞습니다
 *   (같은 요청의 재전송이 아니라 다른 결과를 원하는 것). 네트워크 재시도는 axios 층이 같은 키로 합니다.
 * - seed 는 회차마다 바꿉니다 — 같은 낙서로 같은 seed 면 같은 그림이 나와 "다시" 가 의미 없습니다.
 * - 일일 상한(429 `STICKER_DAILY_LIMIT`)은 여기서 토스트로 알리고 화면은 몫 표시를 갱신합니다.
 */
export function useStickerMaker() {
  const [jobId, setJobId] = useState<number | null>(null);
  /** 결과 옆에 작게 보여줄 내 낙서 (data URL). 서버로 보낸 것과 같은 그림 */
  const [sketchUrl, setSketchUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const job = useStickerJob(jobId);

  const create = useMutation({
    mutationFn: async ({ strokes, seed }: { strokes: Stroke[]; seed: number }) => {
      const blob = await exportDoodlePng(strokes);
      const sketchBase64 = await blobToBase64(blob);
      setSketchUrl(`data:image/png;base64,${sketchBase64}`);
      return stickerApi.create({ sketchBase64, seed }, newIdempotencyKey());
    },
    retry: false, // 실패했으면 사용자가 다시 누르는 게 맞습니다 — 조용히 두 번 만들지 않습니다
    onSuccess: (res) => {
      setJobId(res.jobId);
      queryClient.setQueryData(stickerKeys.quota(), (q?: { limit: number; used: number; remaining: number }) =>
        q ? { ...q, used: q.limit - res.remainingToday, remaining: res.remainingToday } : q,
      );
    },
    onError: (e) => {
      if (ApiError.isApiError(e) && e.code === STICKER_ERROR.DAILY_LIMIT) {
        toast.error('오늘 만들 수 있는 스티커를 다 썼어요. 내일 다시 만들어 주세요');
        queryClient.invalidateQueries({ queryKey: stickerKeys.quota() });
        return;
      }
      toast.error('만들기를 시작하지 못했어요. 잠시 후 다시 시도해 주세요');
    },
  });

  /* DONE 이 된 순간 내 스티커 목록을 새로 받게 표시합니다 — 작업당 한 번 */
  const done = job.data?.status === 'DONE';
  useEffect(() => {
    if (done) queryClient.invalidateQueries({ queryKey: stickerKeys.mine() });
  }, [done, jobId]);

  const start = useCallback(
    (strokes: Stroke[]) => {
      const seed = attempt + 1;
      setAttempt(seed);
      create.mutate({ strokes, seed });
    },
    [attempt, create],
  );

  /** 결과를 접고 그리기로 돌아갑니다. 그림은 그대로 남습니다 (drawStore 가 들고 있음) */
  const reset = useCallback(() => {
    setJobId(null);
    setSketchUrl(null);
  }, []);

  return {
    /** 아직 요청 전이면 null */
    jobId,
    job: job.data ?? null,
    sketchUrl,
    /** 요청을 보내는 중(업로드) 이거나 작업이 도는 중 */
    busy: create.isPending || isWaiting(job.data),
    failed: job.data?.status === 'FAILED' || job.isError,
    start,
    reset,
  };
}
