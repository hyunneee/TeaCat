/**
 * notification feature 의 공개 API.
 *
 * ⚠️ 지금은 **앱이 열려 있는 동안만** 알림이 뜹니다.
 *    앱이 닫혀 있어도 오게 하려면 백엔드 푸시(VAPID)와
 *    서비스워커의 push 핸들러가 필요합니다. (CLAUDE.md 8장)
 */
export { useNotificationPermission } from './hooks/useNotificationPermission';
export { ResaleWinNotifier } from './components/ResaleWinNotifier';
export {
  showNotification,
  readPermission,
  PERMISSION_LABEL,
  type NotificationPermissionState,
  type AppNotification,
} from './model/notification.model';
