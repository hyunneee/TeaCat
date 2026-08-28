/**
 * 웹 알림 (순수 로직).
 *
 * ── 지금 되는 것 / 안 되는 것 ───────────────────────────────
 * ✅ 앱이 열려 있는 동안 알림 띄우기 (권한만 받으면 됨)
 * ❌ **앱이 닫혀 있을 때 서버가 보내는 푸시** — 백엔드에 VAPID 키와
 *    푸시 발송이 있어야 하고, 서비스워커에 `push` 이벤트 핸들러가 필요합니다.
 *    (현재 서비스워커는 `generateSW` 모드로 자동 생성돼 커스텀 핸들러가 없습니다)
 *
 * 그래서 지금은 "앱을 켜 두면 당첨을 알려준다" 까지입니다.
 * 백엔드 푸시가 준비되면 `subscribeToPush` 자리에 구독 로직을 붙이면 됩니다.
 *
 * ── iOS 주의 ────────────────────────────────────────────────
 * iOS 는 **홈 화면에 설치한 PWA 에서만** 알림을 허용합니다(16.4+).
 * 사파리 탭에서는 권한 요청 자체가 실패합니다.
 */

export type NotificationPermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

export function readPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotificationPermissionState;
}

export const PERMISSION_LABEL: Record<NotificationPermissionState, string> = {
  unsupported: '이 브라우저는 알림을 지원하지 않아요',
  default: '알림을 받으려면 허용이 필요해요',
  granted: '알림을 받고 있어요',
  denied: '차단되어 있어요 — 브라우저 설정에서 허용해 주세요',
};

export interface AppNotification {
  title: string;
  body: string;
  /**
   * 같은 tag 의 알림은 서로를 덮어씁니다.
   * 태그가 없으면 폴링이 겹칠 때 같은 알림이 여러 개 쌓입니다.
   */
  tag: string;
  /** 알림을 눌렀을 때 열 주소 */
  url?: string;
}

/**
 * 알림을 띄웁니다. 띄웠으면 true.
 *
 * ⚠️ 모바일 크롬은 `new Notification()` 을 막아 두었습니다.
 *    서비스워커의 `showNotification` 을 먼저 시도하고, 없을 때만 폴백합니다.
 */
export async function showNotification(notification: AppNotification): Promise<boolean> {
  if (readPermission() !== 'granted') return false;

  const options: NotificationOptions = {
    body: notification.body,
    tag: notification.tag,
    // manifest 와 같은 파일을 씁니다. 없으면 브라우저 기본 아이콘이 나옵니다.
    icon: '/icons/pwa-192.png',
    badge: '/icons/pwa-192.png',
    data: { url: notification.url },
  };

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(notification.title, options);
      return true;
    }
    new Notification(notification.title, options);
    return true;
  } catch {
    // 권한이 있어도 브라우저 정책으로 막힐 수 있습니다. 앱이 죽으면 안 됩니다.
    return false;
  }
}
