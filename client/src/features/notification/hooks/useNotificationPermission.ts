import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/shared/stores';
import {
  readPermission,
  type NotificationPermissionState,
} from '../model/notification.model';

/**
 * 알림 권한.
 *
 * ⚠️ 권한 요청은 **사용자가 버튼을 누른 직후에만** 해야 합니다.
 *    화면에 들어오자마자 물어보면 대부분 "차단" 을 누르고, 한 번 차단되면
 *    앱에서는 되돌릴 수 없습니다(브라우저 설정에서 직접 풀어야 함).
 */
export function useNotificationPermission() {
  const [state, setState] = useState<NotificationPermissionState>(readPermission);

  // 브라우저 설정에서 바꿨을 때 화면이 어긋나지 않게
  useEffect(() => {
    const sync = () => setState(readPermission());
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  const request = useCallback(async () => {
    if (readPermission() === 'unsupported') {
      toast.error('이 브라우저는 알림을 지원하지 않아요.');
      return false;
    }

    const result = await Notification.requestPermission();
    setState(result as NotificationPermissionState);

    if (result === 'granted') {
      toast.success('알림을 받도록 설정했어요.');
      return true;
    }
    if (result === 'denied') {
      toast.error('알림이 차단됐어요. 브라우저 설정에서 허용해 주세요.');
    }
    return false;
  }, []);

  return {
    state,
    granted: state === 'granted',
    supported: state !== 'unsupported',
    request,
  };
}
