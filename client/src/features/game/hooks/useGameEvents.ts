import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/features/auth';
import { env } from '@/shared/config';

/**
 * 방이 바뀌었다는 서버 알림을 듣습니다 (SSE).
 *
 * 🔴 **브라우저의 `EventSource` 를 쓰지 않습니다.** `EventSource` 는 요청 헤더를 붙일 수
 * 없어서 액세스 토큰을 쿼리스트링에 실어야 하는데, 그러면 토큰이 nginx 접근 로그와
 * 브라우저 히스토리에 그대로 남습니다. `fetch` 로 열면 `Authorization` 헤더를 그대로
 * 쓸 수 있고, 대신 끊겼을 때 다시 붙는 일을 우리가 해야 합니다(아래 재연결).
 *
 * 🔴 이벤트에는 **게임판이 실려 있지 않습니다.** "다시 읽어라" 는 신호일 뿐이라
 * `onEvent` 안에서 방 조회를 무효화하면 됩니다. 사람마다 가려야 하는 정보(할리갈리의
 * 엎어 둔 카드)가 있어 서버가 일부러 이렇게 나눴습니다.
 */
export function useGameEvents(roomId: number | undefined, onEvent: (event: string) => void) {
  const [connected, setConnected] = useState(false);
  // onEvent 가 매 렌더 새 함수여도 연결을 다시 맺지 않도록 ref 에 담아 둡니다
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!roomId) return;

    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    async function listen() {
      const token = useAuthStore.getState().accessToken;
      if (!token) return;

      try {
        const response = await fetch(`${env.apiBaseUrl}/games/rooms/${roomId}/events`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`);

        setConnected(true);
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += value;
          // SSE 는 빈 줄로 한 덩어리가 끝납니다. 덩어리가 잘려 올 수 있으므로
          // 마지막 조각은 다음 청크와 이어 붙이려고 버퍼에 남겨 둡니다
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() ?? '';

          for (const chunk of chunks) {
            const name = chunk.match(/^event:\s*(.+)$/m)?.[1]?.trim();
            // ping 은 연결을 살려 두기 위한 신호라 화면을 다시 그릴 이유가 없습니다
            if (name && name !== 'ping' && name !== 'ready') handlerRef.current(name);
          }
        }
      } catch {
        // 탭을 숨기거나 네트워크가 흔들리면 늘 납니다. 조용히 다시 붙습니다
      } finally {
        setConnected(false);
        if (!closed) retryTimer = setTimeout(listen, 2000);
      }
    }

    void listen();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      controller.abort();
    };
  }, [roomId]);

  return { connected };
}
