import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * 새 배포를 **조용히** 받아 적용합니다. 화면에 아무것도 그리지 않습니다.
 *
 * PWA 는 서비스워커가 옛 번들을 캐시해두기 때문에, 그냥 두면 사용자가 며칠씩 구버전을
 * 씁니다. 티켓팅에서는 치명적입니다 — 좌석 API 스펙이 바뀌었는데 옛 코드가 돕니다.
 *
 * 예전에는 "새 버전이 준비됐어요" 배너를 띄우고 사용자가 누르게 했습니다. 그런데 그 배너는
 * **안 누르면 그만**이라, 가장 오래 켜 두는 사람(= 티켓팅을 기다리는 사람)이 가장 오래
 * 구버전으로 남았습니다. 지금은 묻지 않고 바로 적용합니다.
 *
 * ⚠️ <b>적용 = 페이지 새로고침입니다.</b> 배포가 나가는 순간 그 탭은 즉시 새로고침되므로,
 *    입력하던 값이나 예매 진행 중 화면이 끊길 수 있습니다. 예매 플로우는 스토어를
 *    sessionStorage 에 두어(`features/booking`) 새로고침을 견디지만, 폼 입력처럼 메모리에만
 *    있는 값은 사라집니다. "예매·결제 중에는 미루기" 도 검토했지만 **즉시 반영**으로
 *    정했습니다 — 구버전이 남는 쪽이 더 위험하다는 판단입니다.
 *
 * 🔴 <b>`registerType` 은 `prompt` 그대로 둡니다</b> (vite.config.ts). `autoUpdate` 로 바꾸면
 *    플러그인이 만든 코드가 알아서 새로고침해 버려서 **이 파일이 시점을 못 정합니다.**
 *    `prompt` 는 "새 워커가 대기 중" 이라고 알려주기만 하고, 적용은 우리가 부릅니다.
 *    나중에 "결제 중에는 미루기" 같은 규칙을 넣으려면 그 손잡이가 여기 있어야 합니다.
 */

/**
 * 새 배포가 났는지 다시 물어보는 주기.
 *
 * 브라우저는 <b>페이지를 새로 열 때</b> 서비스워커 갱신을 확인합니다. SPA 는 화면을 옮겨도
 * 페이지가 새로 열리지 않아서, 앱을 켜 두기만 한 탭은 배포를 영영 모릅니다.
 * 티켓팅을 기다리며 몇 시간씩 열어두는 게 이 서비스의 정상적인 사용이라 직접 물어봅니다.
 */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

export function PwaAutoUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, registration) => {
      if (!registration) return;

      /* 주기적으로 새 배포를 확인합니다. 오프라인이면 실패하는데, 그건 정상이라
         조용히 넘깁니다 — 다음 차례에 다시 묻습니다. */
      setInterval(() => void registration.update().catch(() => {}), UPDATE_CHECK_MS);
    },
  });

  useEffect(() => {
    // true = 대기 중인 워커를 즉시 활성화하고 페이지를 새로고침합니다.
    if (needRefresh) void updateServiceWorker(true);
  }, [needRefresh, updateServiceWorker]);

  return null;
}
