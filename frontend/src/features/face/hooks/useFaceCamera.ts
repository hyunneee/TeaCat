import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 전면 카메라 제어.
 *
 * 주의: getUserMedia 는 **HTTPS 또는 localhost 에서만** 동작합니다.
 * 휴대폰 실기기에서 개발 서버 IP 로 접속하면 카메라가 안 열립니다. (README 참고)
 */
export function useFaceCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      setError(
        name === 'NotAllowedError'
          ? '카메라 권한이 필요해요. 브라우저 설정에서 허용해 주세요.'
          : '카메라를 열 수 없어요. HTTPS 환경인지 확인해 주세요.',
      );
    }
  }, []);

  /** 현재 프레임을 JPEG Blob 으로 캡처 */
  const capture = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video) return null;

    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 정사각형으로 가운데 크롭
    ctx.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      size,
      size,
    );

    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9));
  }, []);

  // 화면을 벗어나면 반드시 카메라를 끕니다 (안 그러면 표시등이 계속 켜져 있음)
  useEffect(() => stop, [stop]);

  return { videoRef, active, error, start, stop, capture };
}
