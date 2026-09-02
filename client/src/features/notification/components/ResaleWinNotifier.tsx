import { useEffect, useRef } from 'react';
import { useMyResaleEntries } from '@/features/resale';
import { ROUTES } from '@/shared/constants';
import { showNotification } from '../model/notification.model';
import { useNotificationPermission } from '../hooks/useNotificationPermission';

/**
 * 취소표 추첨 **당첨 알림** — 그리는 것 없이 감시만 합니다.
 *
 * 당첨은 서버가 취소표가 생길 때 돌리므로 사용자는 그 순간 다른 화면에 있습니다.
 * 결제 마감이 12시간이라 놓치면 자리를 잃습니다 — 그래서 알림이 필요합니다.
 *
 * ── 왜 폴링인가 ────────────────────────────────────────────
 * 서버 푸시(VAPID)가 아직 없어서, 앱이 열려 있는 동안만 확인합니다.
 * WebSocket 이 붙으면 이 컴포넌트 안만 바꾸면 됩니다.
 *
 * ── 권한이 없으면 아무 일도 하지 않습니다 ──────────────────
 * 알림을 못 띄우는데 폴링만 돌면 배터리와 서버만 씁니다.
 *
 * ⚠️ 앱이 **닫혀 있으면 알림이 오지 않습니다.** 백엔드 푸시가 필요합니다.
 */
const POLL_MS = 60_000;
const SEEN_KEY = 'tikat.notified.resale';

function readSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>): void {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    /* 무시 — 알림 중복 방지용일 뿐입니다 */
  }
}

export function ResaleWinNotifier() {
  const { granted } = useNotificationPermission();
  const seen = useRef<Set<string> | null>(null);

  const { data: entries } = useMyResaleEntries({
    enabled: granted,
    refetchInterval: granted ? POLL_MS : false,
  });

  useEffect(() => {
    if (!granted || !entries) return;
    seen.current ??= readSeen();

    const fresh = entries.filter((entry) => entry.status === 'WON' && !seen.current!.has(entry.id));
    if (fresh.length === 0) return;

    fresh.forEach((entry) => seen.current!.add(entry.id));
    writeSeen(seen.current);

    /* 여러 건이 한꺼번에 당첨되면 알림을 쌓지 않고 하나로 묶습니다.
       알림 5개가 연달아 오면 사용자는 그냥 알림을 끕니다. */
    if (fresh.length === 1) {
      const entry = fresh[0]!;
      void showNotification({
        title: '취소표 추첨에 당첨됐어요 🎉',
        body: `${entry.concertTitle} ${entry.sectionName} — 12시간 안에 예매를 마쳐주세요.`,
        tag: `resale-won-${entry.id}`,
        url: ROUTES.MY_RESALE,
      });
      return;
    }

    void showNotification({
      title: `취소표 ${fresh.length}건에 당첨됐어요 🎉`,
      body: '대기 내역에서 확인하고 기한 안에 예매해 주세요.',
      tag: 'resale-won-multi',
      url: ROUTES.MY_RESALE,
    });
  }, [entries, granted]);

  return null;
}
