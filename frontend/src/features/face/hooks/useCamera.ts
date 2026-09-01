import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 전면 카메라 제어.
 *
 * ── 카메라는 반드시 꺼야 합니다 ───────────────────────────
 * track.stop() 을 빠뜨리면 화면을 떠나도 **카메라 표시등이 계속 켜져 있습니다.**
 * 사용자는 앱이 몰래 보고 있다고 생각합니다. 정리 경로를 셋 다 둡니다.
 *   1) 언마운트           — useEffect 정리 함수
 *   2) 탭을 벗어남·화면 잠금 — visibilitychange
 *   3) 페이지 이탈         — pagehide (모바일 사파리는 unload 가 안 옵니다)
 *
 * ⚠️ getUserMedia 는 **HTTPS 또는 localhost 에서만** 동작합니다.
 *    휴대폰 실기기에서 개발 서버 IP 로 접속하면 카메라가 안 열립니다. (README 참고)
 */

export type CameraErrorCode = 'DENIED' | 'NOT_FOUND' | 'IN_USE' | 'INSECURE' | 'UNKNOWN';

export interface CameraError {
  code: CameraErrorCode;
  message: string;
}

/** DOMException 이름 → 사용자가 할 수 있는 행동으로 번역 */
function translate(error: unknown): CameraError {
  const name = error instanceof DOMException ? error.name : '';

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        code: 'DENIED',
        message: '카메라 사용이 차단돼 있어요. 브라우저 주소창의 자물쇠에서 허용해 주세요.',
      };
    case 'NotFoundError':
    case 'OverconstrainedError':
      return { code: 'NOT_FOUND', message: '전면 카메라를 찾지 못했어요.' };
    case 'NotReadableError':
    case 'AbortError':
      return {
        code: 'IN_USE',
        message: '다른 앱이 카메라를 쓰고 있어요. 그 앱을 닫고 다시 시도해 주세요.',
      };
    default:
      return { code: 'UNKNOWN', message: '카메라를 열 수 없어요. 잠시 후 다시 시도해 주세요.' };
  }
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const video = videoRef.current;
    if (video) video.srcObject = null;

    setActive(false);
  }, []);

  const start = useCallback(async () => {
    // HTTPS 가 아니면 API 자체가 없습니다. 권한 거부와 구분해서 안내합니다.
    if (!navigator.mediaDevices?.getUserMedia) {
      setError({
        code: 'INSECURE',
        message: '보안 연결(HTTPS)에서만 카메라를 쓸 수 있어요.',
      });
      return;
    }

    setError(null);
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      } else {
        // 화면이 이미 사라진 뒤에 권한이 떨어진 경우 — 켜자마자 끕니다.
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        return;
      }
      setActive(true);
    } catch (e) {
      setError(translate(e));
    } finally {
      setStarting(false);
    }
  }, []);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') stop();
    };

    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', stop);

    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, [stop]);

  return { videoRef, active, starting, error, start, stop };
}
