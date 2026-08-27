import { Suspense, createElement } from 'react';
import { useModalStore } from '@/shared/stores';
import { MODAL_REGISTRY, type ModalKey } from './registry';

/**
 * 열려 있는 모달 스택을 실제로 렌더링합니다.
 * App 최상단에 딱 한 번 붙고, 이후 모달이 몇 개로 늘어나도 이 파일은 그대로입니다.
 */
export function ModalRoot() {
  const stack = useModalStore((s) => s.stack);
  const close = useModalStore((s) => s.close);

  return (
    <Suspense fallback={null}>
      {stack.map((entry) => {
        const Component = MODAL_REGISTRY[entry.type as ModalKey];
        if (!Component) {
          console.warn(`[ModalRoot] 등록되지 않은 모달: ${entry.type}`);
          return null;
        }
        // onClose 를 자동 주입 -> 호출부는 닫기를 신경 쓸 필요가 없습니다.
        return createElement(Component as never, {
          key: entry.id,
          ...entry.props,
          onClose: () => close(entry.id),
        } as never);
      })}
    </Suspense>
  );
}
