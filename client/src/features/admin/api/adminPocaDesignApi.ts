import { http } from '@/shared/api';
import type { AdminPocaDesign, AdminPocaDesignCreateRequest } from '../model/adminPocaDesign.types';

/**
 * 포토카드 도안 관리 API (Model 레이어).
 *
 * 🔴 전부 서버에서 ADMIN 전용입니다 (`/admin/**`). 화면은 `can.accessAdmin` 으로 먼저 막습니다.
 */
export const adminPocaDesignApi = {
  /** 뽑기 풀 도안 전체 — 공연 도안은 여기 안 옵니다 */
  drawPool: () => http.get<AdminPocaDesign[]>('/admin/photocard-designs/draw-pool'),

  detail: (designId: number) => http.get<AdminPocaDesign>(`/admin/photocard-designs/${designId}`),

  /**
   * 도안 등록. 그림 파일과 함께 보냅니다(multipart).
   *
   * 서버가 그림·메타데이터를 IPFS 에 핀하고 → 도안을 저장하고 → 온체인에 등록합니다.
   * 🔴 핀은 끝났는데 온체인 등록이 실패해도 **도안은 남습니다**(`chainStatus: PENDING`).
   * 그때는 같은 그림을 다시 올리지 말고 `retryRegistration` 을 쓰세요.
   */
  create: (body: AdminPocaDesignCreateRequest) => {
    const form = new FormData();
    form.append('name', body.name);
    form.append('totalSupply', String(body.totalSupply));
    form.append('image', body.image);
    form.append('drawPool', String(body.drawPool));

    if (body.description) form.append('description', body.description);
    if (body.group) form.append('group', body.group);
    if (body.grade) form.append('grade', body.grade);
    if (body.performanceId !== undefined) form.append('performanceId', String(body.performanceId));

    return http.post<AdminPocaDesign>('/admin/photocard-designs', form);
  },

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
  drawPool: () => [...adminPocaDesignKeys.all, 'draw-pool'] as const,
};
