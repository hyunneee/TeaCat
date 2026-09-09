import { http } from '@/shared/api';
import type {
  AdminBanner,
  AdminBannerWriteRequest,
  BannerUploadUrl,
} from '../model/adminBanner.types';

/**
 * 메인 배너 관리 API (Model 레이어).
 *
 * 🔴 전부 서버에서 ADMIN 전용입니다 (`/admin/**`). 화면은 `can.manageBanners` 로
 *    먼저 막아야 합니다.
 */
export const adminBannerApi = {
  list: () => http.get<AdminBanner[]>('/admin/banners'),

  create: (body: AdminBannerWriteRequest) => http.post<AdminBanner>('/admin/banners', body),

  update: (bannerId: number, body: AdminBannerWriteRequest) =>
    http.put<AdminBanner>(`/admin/banners/${bannerId}`, body),

  /** 되돌릴 수 없습니다 (확인 모달 필수). 올린 이미지도 함께 지워집니다 */
  remove: (bannerId: number) => http.delete<void>(`/admin/banners/${bannerId}`),

  /** 지금 있는 배너 **전부**를 원하는 순서대로 보냅니다. 일부만 보내면 서버가 거절합니다 */
  reorder: (bannerIds: number[]) =>
    http.put<AdminBanner[]>('/admin/banners/order', { bannerIds }),

  /** 1단계 — 올릴 자리를 받습니다 */
  issueUploadUrl: (contentType: string) =>
    http.post<BannerUploadUrl>('/admin/banners/uploads/presigned', undefined, {
      params: { contentType },
    }),

  /**
   * 2단계 — 스토리지에 파일을 바로 PUT 합니다.
   *
   * presigned URL 은 서명이 URL 안에 있어 인증 헤더가 하나 더 붙으면 스토리지가 거절합니다.
   * 그래서 우리 axios 인스턴스(토큰을 붙임)를 쓰지 않고 fetch 로 보냅니다.
   */
  uploadImage: async (uploadUrl: string, file: File) => {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    if (!res.ok) throw new Error('이미지를 올리지 못했어요.');
  },
};

export const adminBannerKeys = {
  all: ['admin', 'banners'] as const,
  list: () => [...adminBannerKeys.all, 'list'] as const,
};
