import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/**
 * 카메라를 몇 ms 마다 훑을지.
 *
 * 매 프레임 디코드하면 CPU 를 다 먹습니다. 사람이 QR 을 들이대는 동작은 1초 남짓이라
 * 초당 6번이면 충분히 즉각적으로 느껴집니다. (얼굴 검출을 5fps 로 도는 것과 같은 판단)
 */
const SCAN_INTERVAL_MS = 160;

/** 디코딩에 쓸 캔버스 크기. 원본 해상도로 훑으면 느려지고, 너무 줄이면 못 읽습니다 */
const SCAN_WIDTH = 480;

export interface QrScanner {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** 카메라가 켜져 스캔 중인가 */
  scanning: boolean;
  /** 카메라를 못 켰을 때의 안내 문구 */
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * 카메라로 QR 을 읽습니다.
 *
 * ⚠️ 얼굴 인식(`features/face`)과 **카메라를 동시에 켜지 않습니다.** 한 기기에서 두 스트림을
 * 잡으면 브라우저가 거절하거나 프레임이 뚝뚝 끊깁니다. 화면이 단계에 따라 하나만 켭니다.
 *
 * 🔴 **프레임은 여기서 시작해 여기서 끝납니다.** 캔버스 픽셀을 밖으로 넘기지 마세요 —
 * 이 훅이 내주는 것은 QR 에서 읽은 **문자열 하나**뿐입니다.
 */
export function useQrScanner(onDetect: (text: string) => void): QrScanner {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* 렌더마다 새로 만들어지는 콜백이라 ref 로 최신만 봅니다 —
     의존성에 넣으면 스캔 루프가 계속 다시 시작됩니다 */
  const latest = useRef(onDetect);
  latest.current = onDetect;

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }, []);

  /* 화면을 떠날 때 카메라 불이 꺼져 있어야 합니다 */
  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // 게이트에서는 뒷면 카메라로 상대 폰을 찍습니다
        video: { facingMode: 'environment', width: { ideal: 1280 } },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      video.srcObject = stream;
      await video.play();
      setScanning(true);

      const canvas = (canvasRef.current ??= document.createElement('canvas'));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;

      timerRef.current = setInterval(() => {
        if (!video.videoWidth) return;

        const scale = SCAN_WIDTH / video.videoWidth;
        canvas.width = SCAN_WIDTH;
        canvas.height = Math.round(video.videoHeight * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        /* 반전된 QR(어두운 바탕에 밝은 코드)은 화면에서 나오지 않습니다 */
        const found = jsQR(frame.data, frame.width, frame.height, {
          inversionAttempts: 'dontInvert',
        });

        if (found?.data) latest.current(found.data);
      }, SCAN_INTERVAL_MS);
    } catch {
      /* 권한 거부·카메라 없음·HTTPS 아님이 전부 여기로 옵니다. 어느 쪽이든
         사람이 할 일은 같습니다 — 번호를 손으로 넣으면 됩니다 */
      setError('카메라를 켤 수 없어요. 티켓 번호를 직접 입력해 주세요.');
      setScanning(false);
    }
  }, []);

  return { videoRef, scanning, error, start, stop };
}
