import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptureStep } from '../model/captureSteps';
import { checkFaceQuality, readPose, selectPrimaryFace, type FacePose } from '../model/faceQuality';
import type { DetectedFace } from '../model/face.types';
import type { useFaceEngine } from './useFaceEngine';

/**
 * 지시를 따라 여러 장을 이어 찍는 촬영 세션.
 *
 * <p>얼굴 등록(`FaceRegisterPage`)과 임계값 실측(`/dev/face-bench`)이 <b>같은 코드</b>를
 * 씁니다. 두 벌로 두면 한쪽만 고쳐져서, 등록한 얼굴과 실측한 얼굴이 다른 방식으로 모이게
 * 됩니다 — 그러면 실측한 숫자가 운영과 맞지 않습니다.
 *
 * <p>🔴 <b>얼굴은 브라우저 밖으로 나가지 않습니다.</b> 프레임에서 임베딩만 뽑고 원본은
 * 워커가 즉시 닫습니다. 여기서 들고 있는 것은 임베딩과 자세 숫자뿐입니다.
 * (client/CLAUDE.md 7장)
 */

/** 한 장 찍고 다음 장까지 쉬는 시간. 지시를 읽고 자세를 바꿀 틈이다 */
const SHOT_GAP_MS = 2_000;

export interface GuidedSession {
  taken: number;
  total: number;
  /** 지금 띄울 지시문 */
  prompt: string;
  /** 방금 찍고 다음 자세를 잡는 중 (이 동안 셔터는 겨누지 않는다) */
  preparing: boolean;
  /** 이미 찍은 자세들. 숫자 셋씩이라 생체 특징값이 아니다 */
  poses: FacePose[];
}

/** 지금 프레임이 이번 단계의 지시를 지켰는가 */
export interface StepCheck {
  ok: boolean;
  /** 못 맞췄을 때 보여줄 한 줄 */
  hint: string | null;
}

interface Options {
  engine: ReturnType<typeof useFaceEngine>;
  steps: readonly CaptureStep[];
  /** 한 바퀴를 다 찍었을 때. 모은 임베딩이 순서대로 넘어갑니다 */
  onComplete: (embeddings: Float32Array[]) => void;
}

export function useGuidedCapture({ engine, steps, onComplete }: Options) {
  const [session, setSession] = useState<GuidedSession | null>(null);
  const [capturing, setCapturing] = useState(false);
  /** 캡처 시점에만 알 수 있는 실패 사유 (흔들림·어두움 등) */
  const [issue, setIssue] = useState<string | null>(null);

  /** 이번 세션에서 모은 임베딩. 다 모이면 한 번에 넘깁니다 */
  const collectedRef = useRef<Float32Array[]>([]);
  /** 두 번 겹쳐 들어오는 것을 막습니다. state 로 두면 한 박자 늦습니다 */
  const busyRef = useRef(false);
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* 콜백을 참조로 들고 있어야 합니다 — 의존성에 그대로 넣으면 부모가 리렌더할 때마다
     capture 가 새로 만들어져 진행 중인 세션이 흔들립니다. */
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // 화면을 떠나면 대기 타이머도 걷습니다
  useEffect(
    () => () => {
      if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    },
    [],
  );

  const start = useCallback(() => {
    collectedRef.current = [];
    setIssue(null);
    setSession({
      taken: 0,
      total: steps.length,
      prompt: steps[0]?.prompt ?? '',
      preparing: false,
      poses: [],
    });
  }, [steps]);

  const stop = useCallback(() => {
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    collectedRef.current = [];
    setSession(null);
  }, []);

  /**
   * 지금 화면의 얼굴이 이번 단계의 지시를 지켰는가.
   *
   * <p>화면이 매 프레임 부릅니다 — 순수 계산이라 가볍고, 통과해야만 셔터가 겨눕니다.
   */
  const checkStep = useCallback(
    (faces: readonly DetectedFace[]): StepCheck => {
      if (!session) return { ok: false, hint: null };

      const step = steps[session.taken];
      if (!step) return { ok: false, hint: null };
      if (!step.check) return { ok: true, hint: null }; // 잴 수 없는 단계 (표정)

      const face = selectPrimaryFace(faces);
      const pose = face ? readPose(face) : null;
      if (!pose) return { ok: false, hint: step.hint ?? null };

      return step.check(pose, session.poses)
        ? { ok: true, hint: null }
        : { ok: false, hint: step.hint ?? null };
    },
    [session, steps],
  );

  /** 한 장 찍습니다. 마지막 장이면 {@link Options.onComplete} 가 불립니다 */
  const capture = useCallback(
    async (video: HTMLVideoElement) => {
      if (busyRef.current) return;

      busyRef.current = true;
      setCapturing(true);

      try {
        const result = await engine.embed(video);

        if ('error' in result || !result.embedding) {
          setIssue('얼굴을 처리하지 못했어요. 다시 시도해 주세요.');
          return;
        }

        // 잘라낸 얼굴에서만 알 수 있는 선명도·밝기까지 함께 봅니다
        const quality = checkFaceQuality(result.faces, {
          sharpness: result.sharpness,
          brightness: result.brightness,
        });
        if (quality) {
          setIssue(quality.message);
          return;
        }

        setIssue(null);
        collectedRef.current = [...collectedRef.current, result.embedding];

        const primary = selectPrimaryFace(result.faces);
        const pose = primary ? readPose(primary) : null;

        setSession((current) => {
          if (!current) return null;

          const taken = current.taken + 1;
          const poses = pose ? [...current.poses, pose] : current.poses;

          // 한 바퀴를 다 돌았습니다
          if (taken >= current.total) {
            const collected = collectedRef.current;
            collectedRef.current = [];
            // 렌더 중에 부모 상태를 건드리지 않도록 한 틱 뒤로 미룹니다
            queueMicrotask(() => onCompleteRef.current(collected));
            return null;
          }

          /* 다음 지시를 띄운 채 자세를 바꿀 틈을 줍니다. 이 동안 preparing 이 true 라
             셔터가 겨누지 않습니다 — 안 그러면 자세를 바꾸기도 전에 다음 장이 찍혀
             거의 같은 프레임만 쌓입니다. */
          if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
          gapTimerRef.current = setTimeout(
            () => setSession((s) => (s ? { ...s, preparing: false } : null)),
            SHOT_GAP_MS,
          );

          return {
            ...current,
            taken,
            poses,
            prompt: steps[taken]?.prompt ?? current.prompt,
            preparing: true,
          };
        });
      } finally {
        busyRef.current = false;
        setCapturing(false);
      }
    },
    [engine, steps],
  );

  return { session, capturing, issue, start, stop, checkStep, capture };
}
