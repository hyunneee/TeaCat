import { http } from '@/shared/api';
import type {
  CreateStickerRequest,
  CreateStickerResponse,
  Sticker,
  StickerJob,
  StickerQuota,
} from '../model/sticker.types';

/**
 * AI 스티커 API. 실제 스펙대로 쓰고 응답만 목업(mocks/handlers/sticker.ts)이 대신합니다.
 * 서버가 붙으면 목업 파일만 지우고 이 파일은 그대로입니다 (CLAUDE.md 5장).
 *
 * 경로 메모 — 설계 6-1 은 `GET /stickers/{jobId}` 였는데, `DELETE /stickers/{id}` 와 같은 자리에
 * 서로 다른 id(작업 id · 스티커 id)가 오면 헷갈려서 작업 조회는 `/stickers/jobs/{jobId}` 로 둡니다.
 */
export const stickerApi = {
  /** 생성 요청 → 202 { jobId, remainingToday }. `Idempotency-Key` 는 부르는 쪽이 만들어 넘깁니다 */
  create: (body: CreateStickerRequest, idempotencyKey: string) =>
    http.post<CreateStickerResponse>('/stickers', body, { idempotencyKey }),

  /** 작업 상태 (폴링용) */
  job: (jobId: number) => http.get<StickerJob>(`/stickers/jobs/${jobId}`),

  /** 오늘 몫 */
  quota: () => http.get<StickerQuota>('/stickers/quota'),

  /** 내 스티커 목록 (최근 것 먼저) */
  mine: () => http.get<Sticker[]>('/users/me/stickers'),

  /* 🔴 꾸미기 서랍 전용 — **아직 안 쓴 것만** 옵니다. 전체 목록(mine)을 서랍에 쓰면
     이미 쓴 스티커가 보이고, 눌러도 서버가 거절하는 칸이 됩니다. */
  unused: () => http.get<Sticker[]>('/users/me/stickers/unused'),

  /** 삭제 — 서버는 소프트 삭제 (설계 6-1) */
  remove: (stickerId: number) => http.delete<void>(`/stickers/${stickerId}`),
};

export const stickerKeys = {
  all: ['sticker'] as const,
  job: (jobId: number) => [...stickerKeys.all, 'job', jobId] as const,
  quota: () => [...stickerKeys.all, 'quota'] as const,
  mine: () => [...stickerKeys.all, 'mine'] as const,
  unused: () => [...stickerKeys.all, 'unused'] as const,
};
