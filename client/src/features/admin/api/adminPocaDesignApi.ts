import { http } from '@/shared/api';
import { downscaleImage } from '@/shared/lib';
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
 * 템플릿 조회·등록과 공연 풀은 ADMIN·PERFORMANCE가 사용합니다. 감추기와 이벤트 풀은 ADMIN 전용입니다.
 *
 * 만드는 순서는 **템플릿 → 풀** 입니다.
 *   ① 템플릿 등록: 그림을 IPFS 에 한 번 올립니다 (수량 없음)
 *   ② 공연/이벤트 풀에 넣기: 그 템플릿을 **몇 장** 풀지 정합니다 → 온체인 카드가 됩니다
 */
/**
 * 카드 그림을 줄일 긴 변의 한도(px).
 *
 * 가장 크게 보이는 곳이 크게 보기(`PocaFullscreen`)이고, 앱 기둥이 30rem(480px)이라
 * 카드 폭은 넉넉히 잡아도 330px 안팎입니다. 고해상도 화면(3배)까지 감당할 만큼만 둡니다.
 * (공연 포스터와 같은 기준 — `features/organizer` 의 MAX_IMAGE_WIDTH)
 *
 * ⚠️ WebP 로 올려도 **치수가 크면 여전히 큽니다.** 형식이 아니라 픽셀 수가 전송량을 정합니다.
 */
const POCA_IMAGE_MAX_WIDTH = 1000;

export const adminPocaDesignApi = {
  /* ── 템플릿 ─────────────────────────────────────────── */

  /** 감춘 템플릿은 내려오지 않습니다 */
  templates: () => http.get<AdminPocaTemplate[]>('/admin/photocard-templates'),

  createTemplate: async (body: AdminPocaTemplateCreateRequest) => {
    /* 🔴 올리기 직전이 **유일하게 줄일 수 있는 지점**입니다.
       서버는 형식과 용량(5MB)만 보고 그대로 IPFS 에 핀하고, CID 는 내용 주소라
       한 번 올라가면 **다시 인코딩할 수 없습니다** — 체인에 박힌 값과 어긋납니다.
       포스터·배너는 이미 이 처리를 거치는데(shared/lib/image.ts 주석의 18MB 사건)
       카드 그림만 빠져 있었습니다. 그대로 두면 원본이 모든 사용자에게 영원히 나갑니다. */
    const image = await downscaleImage(body.image, { maxWidth: POCA_IMAGE_MAX_WIDTH });

    const form = new FormData();
    form.append('name', body.name);
    form.append('image', image);
    form.append('group', body.group);
    form.append('grade', body.grade);
    if (body.description) form.append('description', body.description);

    // 🔴 multipart 를 명시합니다 — boundary 는 브라우저가 붙입니다.
    //    axios 기본 헤더가 application/json 이라 안 붙이면 FormData 가 JSON 으로 직렬화돼
    //    이미지가 통째로 사라지고, 서버는 415 를 냅니다 (화면에는 500 으로 보입니다)
    return http.post<AdminPocaTemplate>('/admin/photocard-templates', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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
