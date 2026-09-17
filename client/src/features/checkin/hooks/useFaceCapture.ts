import { useCallback, useState } from 'react';
import {
  checkFaceQuality,
  FACE_GUIDE_IDLE,
  FACE_GUIDE_READY,
  useCamera,
  useFaceEngine,
  useFaceGuide,
  type DetectedFace,
} from '@/features/face';

export interface FaceCapture {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  active: boolean;
  faces: readonly DetectedFace[];
  /** 품질 게이트를 통과했는가 — 가이드 원의 색이 바뀝니다 */
  ready: boolean;
  /** 지금 화면에 띄울 안내 한 줄 */
  message: string;
  /** 사람이 고쳐야 하는 문제인가 (붉게 표시) */
  problem: boolean;
  capturing: boolean;
  start: () => void;
  stop: () => void;
  /** 한 장 찍어 임베딩을 뽑습니다. 품질이 나쁘면 null 을 돌려주고 안내를 띄웁니다 */
  capture: () => Promise<Float32Array | null>;
}

/**
 * 게이트에서 얼굴 한 장을 찍어 **임베딩만** 꺼냅니다.
 *
 * 카메라·검출·품질 게이트를 한 덩어리로 묶은 것뿐이고, 새로 만드는 것은 없습니다 —
 * 회원 얼굴 등록 화면과 **같은 부품**을 씁니다(`features/face`). 검표도 등록도 같은
 * 모델이어야 대조가 되기 때문에, 여기서 따로 만들면 언젠가 갈라집니다.
 *
 * 🔴 **나가는 것은 `Float32Array` 뿐입니다.** 프레임·canvas·Blob 을 돌려주지 마세요 —
 * 그 순간 원본이 이 훅 밖으로 나갑니다 (client/CLAUDE.md 7장).
 */
export function useFaceCapture(): FaceCapture {
  const camera = useCamera();
  /* 모델(약 10MB)은 **카메라를 켤 때** 받습니다. 화면에 들어오기만 해도 받으면
     검표기를 열어둔 내내 쓸데없이 내려받습니다 (FaceRegisterPage 와 같은 판단) */
  const [engineWanted, setEngineWanted] = useState(false);
  const engine = useFaceEngine(engineWanted);
  const guide = useFaceGuide(engine, camera.videoRef.current, camera.active);

  const [capturing, setCapturing] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);

  const engineReady = engine.state === 'ready';
  const ready = camera.active && engineReady && guide.issue === null;

  const start = useCallback(() => {
    setIssue(null);
    setEngineWanted(true);
    void camera.start();
  }, [camera]);

  const stop = useCallback(() => {
    camera.stop();
    setEngineWanted(false);
  }, [camera]);

  const capture = useCallback(async (): Promise<Float32Array | null> => {
    const video = camera.videoRef.current;
    if (!video) return null;

    setIssue(null);
    setCapturing(true);
    try {
      const shot = await engine.embed(video);
      if ('error' in shot) {
        setIssue(shot.error);
        return null;
      }

      /* 🔴 대조 **전에** 품질을 봅니다. 흐리거나 어두운 사진은 같은 사람이어도 점수가
         떨어져서, 그대로 보내면 "본인이 아님" 으로 읽히는 오답이 됩니다.
         게이트에서 그 오답은 사람을 못 들어가게 만듭니다. */
      const quality = checkFaceQuality(shot.faces, {
        sharpness: shot.sharpness,
        brightness: shot.brightness,
      });
      if (quality || !shot.embedding) {
        setIssue(quality?.message ?? '얼굴을 인식하지 못했어요. 다시 시도해 주세요.');
        return null;
      }

      return shot.embedding;
    } finally {
      setCapturing(false);
    }
  }, [camera, engine]);

  const message =
    issue ??
    camera.error?.message ??
    (engine.state === 'failed' ? engine.error : null) ??
    (!camera.active ? null : !engineReady ? '얼굴 인식을 준비하고 있어요…' : null) ??
    guide.issue?.message ??
    (ready ? FACE_GUIDE_READY : FACE_GUIDE_IDLE);

  return {
    videoRef: camera.videoRef,
    active: camera.active,
    faces: guide.faces,
    ready,
    message: message ?? FACE_GUIDE_IDLE,
    problem: Boolean(issue || camera.error || engine.state === 'failed'),
    capturing,
    start,
    stop,
    capture,
  };
}
