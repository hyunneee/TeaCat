import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { ROUTES } from '@/shared/constants';
import { inquiryApi, inquiryKeys } from '../api/inquiryApi';
import type { InquiryWriteRequest } from '../model/inquiry.types';

const message = (error: unknown, fallback: string) =>
  ApiError.isApiError(error) ? error.message : fallback;

/** 등록하면 목록으로 돌아갑니다 — 접수됐다는 걸 목록에서 바로 보게 합니다 */
export function useCreateInquiry() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (body: InquiryWriteRequest) => inquiryApi.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inquiryKeys.all });
      toast.success('문의가 접수됐어요.');
      navigate(ROUTES.MY_INQUIRIES, { replace: true });
    },
    onError: (error) => toast.error(message(error, '문의를 등록하지 못했어요.')),
  });
}

export function useUpdateInquiry(inquiryId: number) {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (body: InquiryWriteRequest) => inquiryApi.update(inquiryId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inquiryKeys.all });
      toast.success('문의가 수정됐어요.');
      navigate(ROUTES.MY_INQUIRY_DETAIL(String(inquiryId)), { replace: true });
    },
    onError: (error) => toast.error(message(error, '문의를 수정하지 못했어요.')),
  });
}

export function useDeleteInquiry() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (inquiryId: number) => inquiryApi.remove(inquiryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inquiryKeys.all });
      toast.info('문의를 삭제했어요.');
      navigate(ROUTES.MY_INQUIRIES, { replace: true });
    },
    onError: (error) => toast.error(message(error, '문의를 삭제하지 못했어요.')),
  });
}
