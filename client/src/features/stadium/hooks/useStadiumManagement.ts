import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { stadiumApi, stadiumKeys } from '../api/stadiumApi';
import type {
  StadiumLayoutSummary,
  StadiumLayoutUpdateRequest,
  StadiumSummary,
  StadiumUpdateRequest,
} from '../model/stadium.types';

const showError = (error: unknown, fallback: string) =>
  toast.error(ApiError.isApiError(error) ? error.message : fallback);

function invalidateStadium(stadiumId?: number) {
  void queryClient.invalidateQueries({ queryKey: stadiumKeys.list() });
  if (stadiumId !== undefined) {
    void queryClient.invalidateQueries({ queryKey: stadiumKeys.detail(stadiumId) });
    void queryClient.invalidateQueries({ queryKey: stadiumKeys.layouts(stadiumId) });
  }
}

export function useStadiumListManagement(onDeleted?: () => void) {
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<StadiumSummary | null>(null);
  const [deleting, setDeleting] = useState<StadiumSummary | null>(null);
  const list = useQuery({
    queryKey: stadiumKeys.list(),
    queryFn: stadiumApi.list,
    staleTime: STALE_TIME.SHORT,
  });

  const stadiums = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return list.data?.stadiums ?? [];
    return (list.data?.stadiums ?? []).filter((stadium) =>
      [stadium.name, stadium.address, stadium.phone ?? ''].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [keyword, list.data?.stadiums]);

  const update = useMutation({
    mutationFn: ({ stadiumId, body }: { stadiumId: number; body: StadiumUpdateRequest }) =>
      stadiumApi.update(stadiumId, body),
    onSuccess: (_, variables) => {
      invalidateStadium(variables.stadiumId);
      toast.success('공연장 정보를 수정했어요.');
      setEditing(null);
    },
    onError: (error) => showError(error, '공연장 수정에 실패했어요.'),
  });

  const remove = useMutation({
    mutationFn: (stadiumId: number) => stadiumApi.delete(stadiumId),
    onSuccess: (_, stadiumId) => {
      invalidateStadium(stadiumId);
      toast.info('공연장을 삭제했어요.');
      setDeleting(null);
      onDeleted?.();
    },
    onError: (error) => showError(error, '공연장 삭제에 실패했어요.'),
  });

  return {
    list,
    stadiums,
    keyword,
    setKeyword,
    editing,
    deleting,
    openEdit: setEditing,
    closeEdit: () => setEditing(null),
    openDelete: setDeleting,
    closeDelete: () => setDeleting(null),
    update,
    remove,
  };
}

export function useStadiumDetailManagement(stadiumId: number) {
  const [selectedLayoutId, setSelectedLayoutId] = useState<number | null>(null);
  const [editingLayout, setEditingLayout] = useState<StadiumLayoutSummary | null>(null);
  const [deletingLayout, setDeletingLayout] = useState<StadiumLayoutSummary | null>(null);
  const stadium = useQuery({
    queryKey: stadiumKeys.detail(stadiumId),
    queryFn: () => stadiumApi.detail(stadiumId),
    enabled: Number.isInteger(stadiumId) && stadiumId > 0,
    staleTime: STALE_TIME.SHORT,
  });
  const layouts = useQuery({
    queryKey: stadiumKeys.layouts(stadiumId),
    queryFn: () => stadiumApi.layouts(stadiumId),
    enabled: Number.isInteger(stadiumId) && stadiumId > 0,
    staleTime: STALE_TIME.SHORT,
  });

  const availableLayouts = layouts.data?.layouts ?? [];
  const selectedLayout =
    availableLayouts.find((layout) => layout.layoutId === selectedLayoutId) ??
    availableLayouts.find((layout) => layout.isDefault) ??
    availableLayouts[0] ??
    null;

  const updateLayout = useMutation({
    mutationFn: ({ layoutId, body }: { layoutId: number; body: StadiumLayoutUpdateRequest }) =>
      stadiumApi.updateLayout(layoutId, body),
    onSuccess: (_, variables) => {
      invalidateStadium(stadiumId);
      void queryClient.invalidateQueries({
        queryKey: stadiumKeys.layoutDetail(variables.layoutId),
      });
      toast.success('배치 정보를 수정했어요.');
      setEditingLayout(null);
    },
    onError: (error) => showError(error, '배치 수정에 실패했어요.'),
  });

  const deleteLayout = useMutation({
    mutationFn: (layoutId: number) => stadiumApi.deleteLayout(layoutId),
    onSuccess: (_, layoutId) => {
      invalidateStadium(stadiumId);
      void queryClient.removeQueries({ queryKey: stadiumKeys.layoutPreview(layoutId) });
      setSelectedLayoutId(null);
      setDeletingLayout(null);
      toast.info('배치를 삭제했어요.');
    },
    onError: (error) => showError(error, '배치 삭제에 실패했어요.'),
  });

  return {
    stadium,
    layouts,
    selectedLayout,
    selectLayout: (layoutId: number) => setSelectedLayoutId(layoutId),
    editingLayout,
    deletingLayout,
    openLayoutEdit: setEditingLayout,
    closeLayoutEdit: () => setEditingLayout(null),
    openLayoutDelete: setDeletingLayout,
    closeLayoutDelete: () => setDeletingLayout(null),
    updateLayout,
    deleteLayout,
  };
}
