import { useCallback, useMemo, useState } from 'react';
import { BENCH_STEPS } from '../model/captureSteps';
import {
  type BenchSample,
  type EnrollMode,
  type GateThresholds,
  equalErrorPoint,
  describe,
  groupProbes,
  groupByPerson,
  lowestZeroFar,
  pairScores,
  simulateGate,
  splitForGate,
  sweepThresholds,
} from '../model/faceBench';
import { useFaceEngine } from './useFaceEngine';
import { useGuidedCapture } from './useGuidedCapture';

/**
 * 임계값 실측 화면의 컨트롤러. (`/dev/face-bench`)
 *
 * <p>촬영은 얼굴 등록 화면과 <b>같은 훅</b>({@link useGuidedCapture})을 씁니다 — 같은 지시,
 * 같은 자세 검증, 같은 품질 게이트입니다. 두 벌로 두면 한쪽만 고쳐져서 <b>실측한 숫자가
 * 운영과 맞지 않게 됩니다.</b> 다른 것은 단계 목록뿐입니다(등록 5장 · 실측 7장).
 *
 * <p><b>사람은 촬영 세션으로 구분합니다.</b> 이름을 받지 않습니다 — 실측하려면 한 사람이
 * 여러 장을 가져야 하고 사람끼리도 갈라야 하는데, 그 구분은 "누가 지금 카메라 앞에
 * 서 있나" 로 충분합니다. 세션 하나가 사람 하나입니다.
 *
 * <p>🔴 <b>얼굴은 브라우저 밖으로 나가지 않습니다.</b> 남는 것은 숫자뿐이고 미리보기도
 * 만들지 않습니다.
 */
export function useFaceBench() {
  const engine = useFaceEngine(true);

  const [samples, setSamples] = useState<BenchSample[]>([]);

  /** 등록에 떼어 둘 장수 */
  const [shotsPerPerson, setShotsPerPerson] = useState(3);
  /** 티켓에 무엇을 저장할지 — 이 선택이 곧 DB 스키마다 */
  const [enrollMode, setEnrollMode] = useState<EnrollMode>('single');
  /** 한 번의 검표에 보내는 장수 (best-of-N) */
  const [bestOfN, setBestOfN] = useState(1);
  const [thresholds, setThresholds] = useState<GateThresholds>({
    match: 0.7,
    review: 0.55,
    margin: 0.05,
  });

  /* ── 촬영 ──────────────────────────────────────────────── */

  /** 지금 찍고 있는 사람. 세션이 시작될 때 정해져 그 세션 내내 고정된다 */
  const [person, setPerson] = useState<string | null>(null);
  /** 마지막으로 찍은 사람. "더 찍기" 가 이 값을 다시 쓴다 */
  const [lastPerson, setLastPerson] = useState<string | null>(null);

  const capture = useGuidedCapture({
    engine,
    steps: BENCH_STEPS,
    onComplete: (embeddings) => {
      const name = person;
      if (!name) return;

      setSamples((previous) => {
        const taken = previous.filter((sample) => sample.person === name).length;
        return [
          ...previous,
          ...embeddings.map((embedding, index) => ({
            person: name,
            fileName: `${name}_cam${String(taken + index + 1).padStart(2, '0')}`,
            embedding,
          })),
        ];
      });
      setPerson(null);
    },
  });

  /**
   * 한 바퀴 찍기 시작합니다.
   *
   * <p><b>이름을 받지 않습니다.</b> 세션 하나가 사람 하나이고 번호는 자동으로 붙습니다 —
   * 사람이 바뀔 때마다 타자를 치게 하면 8~10명을 찍는 동안 그게 제일 번거롭습니다.
   *
   * @param samePerson true 면 방금 찍은 사람을 이어서 찍습니다 (조명·거리를 바꿔 한 바퀴 더)
   */
  const startSession = useCallback(
    (samePerson = false) => {
      const name =
        samePerson && lastPerson ? lastPerson : `사람 ${groupByPerson(samples).size + 1}`;

      setPerson(name);
      setLastPerson(name);
      capture.start();
    },
    [capture, lastPerson, samples],
  );

  const stopSession = useCallback(() => {
    setPerson(null);
    capture.stop();
  }, [capture]);

  const reset = useCallback(() => {
    setSamples([]);
    setPerson(null);
    setLastPerson(null);
  }, []);

  /* 계산은 전부 순수 함수입니다. 사진이 늘면 쌍이 제곱으로 늘어나므로 memo 합니다 */
  const people = useMemo(() => groupByPerson(samples), [samples]);
  const scores = useMemo(() => pairScores(samples), [samples]);
  const sweep = useMemo(() => sweepThresholds(scores), [scores]);

  const split = useMemo(
    () => splitForGate(samples, shotsPerPerson, enrollMode),
    [samples, shotsPerPerson, enrollMode],
  );
  const probeGroups = useMemo(() => groupProbes(split.probes, bestOfN), [split.probes, bestOfN]);
  const gate = useMemo(
    () => simulateGate(split.templates, probeGroups, thresholds),
    [split.templates, probeGroups, thresholds],
  );

  return {
    engine,
    samples,
    people,
    reset,

    capture,
    person,
    lastPerson,
    startSession,
    stopSession,

    genuine: useMemo(() => describe(scores.genuine), [scores.genuine]),
    impostor: useMemo(() => describe(scores.impostor), [scores.impostor]),
    sweep,
    eer: useMemo(() => equalErrorPoint(sweep), [sweep]),
    zeroFar: useMemo(() => lowestZeroFar(sweep), [sweep]),

    shotsPerPerson,
    setShotsPerPerson,
    enrollMode,
    setEnrollMode,
    bestOfN,
    setBestOfN,
    thresholds,
    setThresholds,
    split,
    gate,
  };
}
