import { http } from '@/shared/api';
import type {
  AdminPerformanceDrawPool,
  AdminPocaDesign,
  AdminPocaTemplate,
  AdminPocaTemplateCreateRequest,
  PocaPoolItem,
} from '../model/adminPocaDesign.types';

/**
 * 포토카드 템플릿·도안 관리 API (Model 레이어).
 *
 * 🔴 전부 서버에서 ADMIN 전용입니다 (`/admin/**`). 화면은 `can.accessAdmin` 으로 먼저 막습니다.
 *
 * 만드는 순서는 **템플릿 → 풀** 입니다.
 *   ① 템플릿 등록: 그림을 IPFS 에 한 번 올립니다 (수량 없음)
 *   ② 공연/이벤트 풀에 넣기: 그 템플릿을 **몇 장** 풀지 정합니다 → 온체인 카드가 됩니다
 */
export const adminPocaDesignApi = {
  /* ── 템플릿 ─────────────────────────────────────────── */

  /** 감춘 템플릿은 내려오지 않습니다 */
  templates: () => http.get<AdminPocaTemplate[]>('/admin/photocard-templates'),

  createTemplate: (body: AdminPocaTemplateCreateRequest) => {
    const form = new FormData();
    form.append('name', body.name);
    form.append('image', body.image);
    form.append('group', body.group);
    form.append('grade', body.grade);
    if (body.description) form.append('description', body.description);

    return http.post<AdminPocaTemplate>('/admin/photocard-templates', form);
  },

  /**
   * 감추기/되살리기.
   * 🔴 **삭제 API 는 없습니다.** 도안들이 같은 IPFS 그림을 가리켜서, 지우면 그 그림을 쓰는
   * 모든 도안의 이미지가 깨집니다. 감추면 새로 고를 수 없을 뿐 기존 카드는 그대로 동작합니다.
   */
  setTemplateHidden: (templateId: number, hidden: boolean) =>
    http.patch<AdminPocaTemplate>(`/admin/photocard-templates/${templateId}`, { hidden }),

  /* ── 공연별 뽑기 풀 ──────────────────────────────────── */

  performancePool: (performanceId: number) =>
    http.get<AdminPerformanceDrawPool>(`/admin/performances/${performanceId}/draw-designs`),

  /**
   * 공연 풀에 카드를 넣습니다. 응답은 **갱신된 풀 전체**입니다.
   * 🔴 `totalSupply` 가 온체인 maxSupply 로 박히고, 첫 장이 발급되면 못 바꿉니다.
   */
  addPerformanceDesigns: (performanceId: number, items: PocaPoolItem[]) =>
    http.post<AdminPerformanceDrawPool>(`/admin/performances/${performanceId}/draw-designs`, {
      items,
    }),

  /* ── 이벤트 풀 ──────────────────────────────────────── */

  /** 공연 없는 도안만 옵니다 (이벤트 풀) */
  eventPool: () => http.get<AdminPocaDesign[]>('/admin/photocard-designs/draw-pool'),

  /**
   * 이벤트 풀에 카드를 넣습니다. 응답은 **새로 만든 것만** 이라, 화면은 목록을 다시 읽습니다.
   * 🔴 이벤트 풀은 **하나를 공유**합니다 — 이벤트를 여러 개 열어도 같은 카드에서 뽑힙니다.
   */
  addEventPoolDesigns: (items: PocaPoolItem[]) =>
    http.post<AdminPocaDesign[]>('/admin/photocard-designs/event-pool', { items }),

  /* ── 도안 ───────────────────────────────────────────── */

  /**
   * 뽑기에서 빼기/넣기.
   * 🔴 **삭제가 아닙니다.** 온체인 등록도, 이미 발행된 카드도 그대로입니다 —
   * 앞으로 뽑히지 않게 될 뿐입니다. 이벤트 풀 도안은 뺄 수 없습니다(409 NFT_048).
   */
  setDrawPool: (designId: number, drawPool: boolean) =>
    http.patch<AdminPocaDesign>(`/admin/photocard-designs/${designId}/draw-pool`, { drawPool }),

  /**
   * 온체인 등록 재시도. 멱등이라 여러 번 보내도 안전합니다.
   * `force` 는 확정 대기(`REGISTERING`)에 묶인 도안까지 다시 보냅니다 — 감시가 멈췄을 때만.
   */
  retryRegistration: (designId: number, force = false) =>
    http.post<AdminPocaDesign>(
      `/admin/photocard-designs/${designId}/chain-registration`,
      undefined,
      { params: { force } },
    ),
};

export const adminPocaDesignKeys = {
  all: ['admin', 'poca-designs'] as const,
  templates: () => [...adminPocaDesignKeys.all, 'templates'] as const,
  eventPool: () => [...adminPocaDesignKeys.all, 'event-pool'] as const,
  performancePool: (performanceId: number) =>
    [...adminPocaDesignKeys.all, 'performance', performanceId] as const,
};
