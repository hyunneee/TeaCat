import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { STALE_TIME } from '@/shared/constants';
import { bannerKeys } from '@/features/banner';
import { adminBannerApi, adminBannerKeys } from '../api/adminBannerApi';
import type { AdminBannerWriteRequest } from '../model/adminBanner.types';

const message = (error: unknown, fallback: string) =>
  ApiError.isApiError(error) ? error.message : fallback;

/**
 * 관리 화면 목록 — 노출을 끈 배너까지 전부 옵니다.
 *
 * 홈 배너(`bannerKeys`)와 같은 데이터라, 바꿀 때마다 양쪽을 함께 털어냅니다.
 * 한쪽만 무효화하면 관리 화면에서 고친 게 홈에 안 보입니다.
 */
export function useAdminBanners() {
  return useQuery({
    queryKey: adminBannerKeys.list(),
    queryFn: adminBannerApi.list,
    staleTime: STALE_TIME.SHORT,
  });
}

function invalidateBanners() {
  void queryClient.invalidateQueries({ queryKey: adminBannerKeys.all });
  void queryClient.invalidateQueries({ queryKey: bannerKeys.all });
}

export function useCreateBanner() {
  return useMutation({
    mutationFn: (body: AdminBannerWriteRequest) => adminBannerApi.create(body),
    onSuccess: () => {
      invalidateBanners();
      toast.success('배너를 등록했어요.');
    },
    onError: (error) => toast.error(message(error, '배너를 등록하지 못했어요.')),
  });
}

export function useUpdateBanner() {
  return useMutation({
    mutationFn: ({ bannerId, body }: { bannerId: number; body: AdminBannerWriteRequest }) =>
      adminBannerApi.update(bannerId, body),
    onSuccess: () => {
      invalidateBanners();
      toast.success('배너를 수정했어요.');
    },
    onError: (error) => toast.error(message(error, '배너를 수정하지 못했어요.')),
  });
}

export function useDeleteBanner() {
  return useMutation({
    mutationFn: (bannerId: number) => adminBannerApi.remove(bannerId),
    onSuccess: () => {
      invalidateBanners();
      toast.info('배너를 삭제했어요.');
    },
    onError: (error) => toast.error(message(error, '배너를 삭제하지 못했어요.')),
  });
}

/** 위·아래로 한 칸 옮기기. 서버는 전체 순서를 받으므로 화면이 새 순서를 만들어 보냅니다 */
export function useReorderBanners() {
  return useMutation({
    mutationFn: (bannerIds: number[]) => adminBannerApi.reorder(bannerIds),
    onSuccess: () => invalidateBanners(),
    onError: (error) => toast.error(message(error, '순서를 바꾸지 못했어요.')),
  });
}

/**
 * 이미지 업로드 — 업로드 URL 발급 → 스토리지에 PUT → key 반환.
 *
 * 파일 바이트가 우리 서버를 거치지 않습니다. 받은 key 를 등록·수정 요청에 넣으세요.
 */
export function useUploadBannerImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const issued = await adminBannerApi.issueUploadUrl(file.type);

      if (file.size > issued.maxFileSizeBytes) {
        // 올린 뒤 거절되면 대역폭만 낭비입니다. 서버가 준 한도로 먼저 거릅니다
        throw new Error(
          `이미지가 너무 큽니다. ${Math.floor(issued.maxFileSizeBytes / (1024 * 1024))}MB 이하로 올려주세요.`,
        );
      }

      await adminBannerApi.uploadImage(issued.uploadUrl, file);
      return issued.key;
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '이미지를 올리지 못했어요.'),
  });
}
