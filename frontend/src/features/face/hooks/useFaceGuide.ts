import { useEffect, useRef, useState } from 'react';
import { checkFaceQuality } from '../model/faceQuality';
import type { DetectedFace, FaceQualityIssue } from '../model/face.types';
import type { useFaceEngine } from './useFaceEngine';

/**
 * 가이드 루프 — **가벼운 검출기만 5fps** 로 돌려 "지금 찍어도 되는지"를 알려줍니다.
 *
 * 🔴 여기서 임베딩 모델을 돌리면 안 됩니다. 무거운 모델은 캡처 버튼 한 번뿐입니다.
 *    (CLAUDE.md 7장 성능 규칙)
 *
 * ── 왜 setInterval 이 아니라 재귀인가 ─────────────────────
 * 검출 한 번이 200ms 를 넘을 수도 있습니다. setInterval 로 밀어 넣으면
 * 처리 못 한 프레임이 큐에 쌓여 화면이 점점 뒤처집니다.
 * **한 번 끝나면 다음 걸 예약**하는 방식이라 절대 밀리지 않습니다.
 */

const INTERVAL_MS = 200; // 5fps

export function useFaceGuide(
  engine: ReturnType<typeof useFaceEngine>,
  video: HTMLVideoElement | null,
  enabled: boolean,
) {
  const [faces, setFaces] = useState<DetectedFace[]>([]);
  const [issue, setIssue] = useState<FaceQualityIssue | null>(null);

  // 최신 detect 를 참조로 들고 있어야 effect 가 매번 재시작하지 않습니다.
  const detectRef = useRef(engine.detect);
  detectRef.current = engine.detect;

  useEffect(() => {
    if (!enabled || !video) {
      setFaces([]);
      setIssue(null);
      return;
    }

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (stopped) return;

      try {
        const found = await detectRef.current(video);
        if (stopped) return;
        setFaces(found);
        setIssue(checkFaceQuality(found));
      } catch {
        /* 한 프레임 실패는 무시합니다 — 다음 틱에 다시 봅니다 */
      }

      if (!stopped) timer = setTimeout(() => void tick(), INTERVAL_MS);
    };

    void tick();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, video]);

  return { faces, issue };
}
