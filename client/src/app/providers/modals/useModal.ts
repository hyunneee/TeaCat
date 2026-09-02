import { useCallback } from 'react';
import { useModalStore } from '@/shared/stores';
import type { ModalKey, ModalPropsMap } from './registry';

/**
 * 타입 안전한 모달 열기/닫기.
 *
 *   const { open } = useModal();
 *   open('common/confirm', {
 *     title: '예매를 취소할까요?',
 *     danger: true,
 *     onConfirm: () => cancel(),
 *   });
 *
 * onClose 는 모달 시스템이 자동으로 주입하므로 넘길 필요가 없습니다.
 */
export function useModal() {
  const openRaw = useModalStore((s) => s.open);
  const close = useModalStore((s) => s.close);
  const closeAll = useModalStore((s) => s.closeAll);

  const open = useCallback(
    <K extends ModalKey>(key: K, props: Omit<ModalPropsMap[K], 'onClose'>) =>
      openRaw(key, props as Record<string, unknown>),
    [openRaw],
  );

  return { open, close, closeAll };
}
