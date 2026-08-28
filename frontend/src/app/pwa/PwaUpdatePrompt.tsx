import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/shared/components/ui';

/**
 * 새 버전이 배포되면 알려주는 배너.
 *
 * PWA 는 서비스워커가 옛날 번들을 캐시해두기 때문에,
 * 알려주지 않으면 사용자가 며칠 동안 구버전을 쓰게 됩니다.
 * 티켓팅 서비스에서 이건 치명적입니다 (좌석 API 스펙이 바뀌었는데 옛 코드가 돎).
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (url) => console.info('[PWA] service worker 등록됨', url),
    onRegisterError: (error) => console.error('[PWA] 등록 실패', error),
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="surface mx-auto flex max-w-sm items-center gap-3 rounded-2xl border p-4 shadow-xl">
        <p className="flex-1 text-sm">새 버전이 준비됐어요.</p>
        <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
          나중에
        </Button>
        <Button size="sm" onClick={() => void updateServiceWorker(true)}>
          업데이트
        </Button>
      </div>
    </div>
  );
}
