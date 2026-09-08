import { useCallback, useEffect, useRef } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import { useModalStore } from '@/shared/stores';

/**
 * 저장하지 않은 변경이 있을 때 화면을 떠나려 하면 한 번 묻습니다.
 *
 * - 앱 안 이동(뒤로가기·탭 전환)은 라우터 blocker 로 막고 확인 모달을 띄웁니다.
 * - 새로고침·탭 닫기는 브라우저 기본 경고(`beforeunload`)에 맡깁니다. 거기엔 우리 모달을 띄울 수 없습니다.
 *
 * 저장에 성공해 **의도적으로** 떠날 때는 `release()` 를 먼저 호출하세요.
 * 저장 직후 상태가 아직 갱신되지 않은 렌더에서도 blocker 가 최신 의도를 읽어야 하므로 ref 로 둡니다.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const releasedRef = useRef(false);
  const open = useModalStore((s) => s.open);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (releasedRef.current || !dirty) return false;
    // 같은 경로 안의 쿼리·해시 변화는 떠나는 게 아닙니다
    return currentLocation.pathname !== nextLocation.pathname;
  });

  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (dirty && !releasedRef.current) event.preventDefault();
      },
      [dirty],
    ),
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;

    open('common/confirm', {
      title: '저장하지 않은 변경이 있어요',
      message: '이 화면을 나가면 수정한 내용이 사라집니다. 저장하려면 취소를 누르고 저장하기를 눌러 주세요.',
      confirmText: '나가기',
      cancelText: '계속 수정',
      danger: true,
      onConfirm: () => blocker.proceed(),
      // 취소하면 blocker 를 풀어둬야 다음 이동 시도가 다시 걸립니다
      onCancel: () => blocker.reset(),
    });
  }, [blocker, open]);

  const release = useCallback(() => {
    releasedRef.current = true;
  }, []);

  return { release };
}
