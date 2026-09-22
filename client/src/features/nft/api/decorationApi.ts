import { http } from '@/shared/api';
import type { Decoration } from '../model/decoration.types';

/**
 * 포카 꾸미기 API — 서버 `NftDecorationController` 경로 그대로.
 * 셋 다 **소유자만** 부를 수 있습니다 (서버가 다시 확인합니다).
 */
export const decorationApi = {
  /**
   * 다시 꾸미기용. 🔴 **꾸민 적이 없으면 404(`NFT_065`) 가 정상**입니다 —
   * 부르는 쪽(`useDecoration`)이 그것만 걸러 `null` 로 바꿉니다.
   */
  get: (photocardId: number) => http.get<Decoration>(`/photocards/${photocardId}/decoration`),

  /** 저장(덮어쓰기). 카드당 하나입니다 */
  save: (photocardId: number, body: { imageBase64: string; placements: string }) =>
    http.put<Decoration>(`/photocards/${photocardId}/decoration`, body),

  /** 꾸밈 지우기 — 원본만 남습니다. 되돌릴 수 없습니다 */
  remove: (photocardId: number) => http.delete<void>(`/photocards/${photocardId}/decoration`),
};

export const decorationKeys = {
  all: ['decoration'] as const,
  detail: (photocardId: number) => [...decorationKeys.all, photocardId] as const,
};
