import { cosineSimilarity, l2Normalize } from './embedding';

/**
 * 임계값 실측 계산 — **순수 함수만.** (React·DOM·워커 모름)
 *
 * `gate.threshold.{match,review,margin}` 에 넣을 숫자를 정하기 위한 것입니다.
 * 지금 서버에 들어 있는 0.70 / 0.55 / 0.05 는 **근거 없는 자리 채우기**라,
 * 실제 사람들 얼굴로 재서 바꿔야 합니다. (GATE_PLAN.md 8-3)
 *
 * ── 왜 1:1 점수만 봐서는 안 되나 ──────────────────────────
 * "같은 사람은 몇 점, 다른 사람은 몇 점" 은 1:1 본인확인의 질문입니다.
 * 게이트는 **1:N** 이라 질문이 다릅니다 — 후보가 늘수록 "남인데 우연히 가장 닮은
 * 사람" 이 나올 확률이 커지고, 1등과 2등이 붙는 상황도 생깁니다. 그래서
 * {@link simulateGate} 가 실제 판정 규칙을 그대로 돌려 봅니다.
 *
 * 🔴 여기 들어오는 임베딩은 생체 특징값입니다. **값을 로그로 찍지 마세요.**
 */

export interface BenchSample {
  /** 누구인가. 촬영 세션마다 자동으로 붙는 번호입니다 (`사람 1`, `사람 2` …) */
  person: string;
  /** 화면 표시용 이름. 판정에는 쓰이지 않습니다 */
  fileName: string;
  embedding: Float32Array;
}

/** 사람별로 묶습니다. 넣은 순서를 유지합니다 (앞쪽 몇 장을 등록에 씁니다) */
export function groupByPerson(samples: readonly BenchSample[]): Map<string, BenchSample[]> {
  const byPerson = new Map<string, BenchSample[]>();

  for (const sample of samples) {
    const list = byPerson.get(sample.person);
    if (list) list.push(sample);
    else byPerson.set(sample.person, [sample]);
  }

  return byPerson;
}

/* ── 1:1 분포 ─────────────────────────────────────────────── */

export interface PairScores {
  /** 같은 사람끼리 (genuine). 이 값이 낮게 깔리면 본인이 거절당합니다 */
  genuine: number[];
  /** 다른 사람끼리 (impostor). 🔴 이쪽의 **최댓값**이 가장 중요한 숫자입니다 */
  impostor: number[];
}

/** 모든 쌍의 코사인 유사도를 같은 사람 / 다른 사람으로 갈라 모읍니다 */
export function pairScores(samples: readonly BenchSample[]): PairScores {
  const genuine: number[] = [];
  const impostor: number[] = [];

  for (let i = 0; i < samples.length; i += 1) {
    for (let j = i + 1; j < samples.length; j += 1) {
      const a = samples[i]!;
      const b = samples[j]!;
      const score = cosineSimilarity(a.embedding, b.embedding);
      (a.person === b.person ? genuine : impostor).push(score);
    }
  }

  return { genuine, impostor };
}

export interface Distribution {
  count: number;
  min: number;
  p50: number;
  p95: number;
  max: number;
}

export function describe(values: readonly number[]): Distribution | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const at = (ratio: number) => sorted[Math.round(ratio * (sorted.length - 1))]!;

  return {
    count: sorted.length,
    min: sorted[0]!,
    p50: at(0.5),
    p95: at(0.95),
    max: sorted[sorted.length - 1]!,
  };
}

/* ── FRR / FAR 스윕 ───────────────────────────────────────── */

export interface SweepPoint {
  threshold: number;
  /** 본인 거절률 — 올리면 입구에 줄이 섭니다 */
  frr: number;
  /** 오인 통과율 — 올리면 남이 들어옵니다. 이쪽이 훨씬 비쌉니다 */
  far: number;
}

/**
 * 임계값을 훑으며 두 오류율을 잽니다.
 *
 * <p>둘은 반대로 움직입니다. 올리면 남은 막히고 본인도 막히며, 내리면 둘 다 통과합니다.
 * "어디가 정답" 은 없고 **무엇이 더 비싼가**로 정합니다 — 입장 통제에서는
 * 남을 들여보내는 쪽(FAR)이 본인을 한 번 더 찍게 하는 쪽(FRR)보다 훨씬 비쌉니다.
 */
export function sweepThresholds(scores: PairScores, step = 0.01): SweepPoint[] {
  /* 🔴 한쪽이라도 비어 있으면 훑지 않습니다 — 빈 배열의 비율은 0 이라, 그대로 두면
     "본인 거절 0% · 오인 통과 0%" 라는 **완벽한 성적표**가 만들어집니다. 사람이 한 명뿐일
     때도 마찬가지입니다(다른 사람 쌍이 없어 FAR 이 항상 0). 데이터가 없는 것과
     결과가 좋은 것은 다릅니다. */
  if (scores.genuine.length === 0 || scores.impostor.length === 0) return [];

  const points: SweepPoint[] = [];

  for (let threshold = 0.2; threshold <= 0.95 + 1e-9; threshold += step) {
    const value = Math.round(threshold * 1000) / 1000;
    points.push({
      threshold: value,
      frr: ratio(scores.genuine, (score) => score < value),
      far: ratio(scores.impostor, (score) => score >= value),
    });
  }

  return points;
}

/** 두 오류율이 만나는 지점. 모델이 이 데이터에서 얼마나 하는지 한 숫자로 보는 값입니다 */
export function equalErrorPoint(points: readonly SweepPoint[]): SweepPoint | null {
  if (points.length === 0) return null;

  return points.reduce((best, point) =>
    Math.abs(point.frr - point.far) < Math.abs(best.frr - best.far) ? point : best,
  );
}

/** 오인 통과가 0 이 되는 가장 낮은 임계값. 실무에서 고르는 출발점입니다 */
export function lowestZeroFar(points: readonly SweepPoint[]): SweepPoint | null {
  return points.find((point) => point.far === 0) ?? null;
}

/* ── 1:N 게이트 시뮬레이션 ─────────────────────────────────── */

export interface GateThresholds {
  match: number;
  review: number;
  margin: number;
}

export interface GateResult {
  trials: number;
  /** 본인을 통과시켰다 */
  correctAdmit: number;
  /** 🔴 **남을 통과시켰다.** 이 기능이 존재하는 이유가 이걸 0 으로 만드는 것입니다 */
  wrongAdmit: number;
  /** 보류인데 화면에 뜬 후보가 맞는 사람 — 운영자가 통과시키면 됩니다 */
  reviewCorrect: number;
  /** 보류인데 후보가 틀린 사람 — 운영자가 걸러야 합니다 */
  reviewWrong: number;
  /** 본인인데 거절당했다. 늘어나면 입구에 줄이 섭니다 */
  reject: number;
}

/**
 * 실제 판정 규칙을 그대로 돌립니다.
 *
 * <p>🔴 <b>서버의 {@code GateVerifyService.findBest} 와 같은 규칙이어야 합니다.</b>
 * 프레임마다 1등·2등을 구하고, <b>1등이 가장 높은 프레임</b>을 고른 뒤 그 프레임의
 * 2등으로 마진을 잽니다. 프레임마다 후보 순위가 다를 수 있으므로 마진은 반드시
 * 같은 프레임 안에서 재야 의미가 있습니다. 여기가 갈라지면 이 화면의 숫자는
 * 운영과 다른 이야기를 하게 됩니다.
 *
 * @param probeGroups 한 번의 검표 시도. 여러 장이면 best-of-N 입니다
 */
export function simulateGate(
  templates: readonly BenchSample[],
  probeGroups: readonly (readonly BenchSample[])[],
  thresholds: GateThresholds,
): GateResult {
  const result: GateResult = {
    trials: 0,
    correctAdmit: 0,
    wrongAdmit: 0,
    reviewCorrect: 0,
    reviewWrong: 0,
    reject: 0,
  };

  if (templates.length === 0) return result;

  for (const group of probeGroups) {
    const truth = group[0]?.person;
    if (truth === undefined) continue;

    result.trials += 1;

    let best: { person: string; top1: number; top2: number | null } | null = null;

    for (const probe of group) {
      /* 🔴 <b>사람 단위로 줄여야 합니다.</b> 한 사람이 템플릿을 여러 개 가지면
         (`multi`) 1등과 2등이 **같은 사람의 다른 사진**이 되어 마진이 늘 0 에 가깝고,
         그러면 모든 판정이 보류로 떨어집니다. 사람마다 가장 잘 맞는 것 하나로 줄인 뒤
         줄을 세웁니다 — 이게 "누구인가" 라는 질문의 올바른 모양입니다. */
      const bestPerPerson = new Map<string, number>();
      for (const template of templates) {
        const score = cosineSimilarity(template.embedding, probe.embedding);
        if (!Number.isFinite(score)) continue;

        const previous = bestPerPerson.get(template.person);
        if (previous === undefined || score > previous) {
          bestPerPerson.set(template.person, score);
        }
      }

      const ranked = [...bestPerPerson.entries()]
        .map(([person, score]) => ({ person, score }))
        .sort((a, b) => b.score - a.score);

      const top1 = ranked[0];
      if (!top1) continue;

      if (!best || top1.score > best.top1) {
        best = { person: top1.person, top1: top1.score, top2: ranked[1]?.score ?? null };
      }
    }

    if (!best) {
      result.reject += 1;
      continue;
    }

    /* 후보가 하나뿐이면 헷갈릴 상대가 없으므로 마진은 무한대입니다.
       0 으로 두면 단 한 명 남은 관객이 영영 보류됩니다 (서버도 같은 규칙). */
    const margin = best.top2 === null ? Number.POSITIVE_INFINITY : best.top1 - best.top2;
    const correct = best.person === truth;

    if (best.top1 >= thresholds.match && margin >= thresholds.margin) {
      if (correct) result.correctAdmit += 1;
      else result.wrongAdmit += 1;
    } else if (best.top1 >= thresholds.review) {
      if (correct) result.reviewCorrect += 1;
      else result.reviewWrong += 1;
    } else {
      result.reject += 1;
    }
  }

  return result;
}

/** L2 정규화된 평균. 등록을 여러 장으로 할 때 쓰는 대표 벡터입니다 */
export function centroidOf(embeddings: readonly Float32Array[]): Float32Array {
  const first = embeddings[0];
  if (!first) return new Float32Array(0);

  const sum = new Float32Array(first.length);
  for (const embedding of embeddings) {
    for (let i = 0; i < sum.length; i += 1) sum[i] = sum[i]! + (embedding[i] ?? 0);
  }

  return l2Normalize(sum);
}

/**
 * 등록해 둔 얼굴을 어떤 모양으로 들고 있을지.
 *
 * <p>티켓 하나에 무엇을 저장할지의 문제라 <b>DB 스키마가 갈립니다.</b> 여기서 재보고
 * 정하려는 것이 그것입니다.
 */
export type EnrollMode =
  /** 벡터 한 개. **지금 운영이 이 모양입니다** (`tickets.face_embedding` 한 칸) */
  | 'single'
  /** 여러 장을 평균 낸 벡터 한 개. 저장은 한 칸 그대로, 분산만 줄입니다 */
  | 'centroid'
  /** 벡터 N 개를 전부 저장하고 **가장 잘 맞는 것**을 씁니다. 티켓당 N 행이 필요합니다 */
  | 'multi';

export interface SplitResult {
  /** 등록해 둔 얼굴. `multi` 면 한 사람이 여러 개를 가집니다 */
  templates: BenchSample[];
  /** 검표대에서 찍힌 셈 치는 나머지 사진들 */
  probes: BenchSample[];
  /** 사진이 모자라 시험할 수 없는 사람 (등록에 다 써버림) */
  probelessPeople: string[];
}

/**
 * 앞에서 {@code shotsPerPerson} 장을 등록에 쓰고 나머지를 검표 시도로 씁니다.
 *
 * <p>모드를 바꿔 가며 보면 <b>티켓에 무엇을 저장해야 하는지</b>가 숫자로 나옵니다.
 *
 * <p>🔴 <b>{@code multi} 는 공짜가 아닙니다.</b> 템플릿이 N 개면 본인도 N 번의 기회를
 * 얻지만 <b>남도 N 번의 기회를 얻습니다</b> — 오인 통과율이 함께 오릅니다. 보통은
 * 순이득이지만 N 이 커질수록 이득이 줄고 위험이 늘어서, 몇 개가 적당한지는
 * 재봐야만 알 수 있습니다.
 */
export function splitForGate(
  samples: readonly BenchSample[],
  shotsPerPerson: number,
  mode: EnrollMode = 'centroid',
): SplitResult {
  const templates: BenchSample[] = [];
  const probes: BenchSample[] = [];
  const probelessPeople: string[] = [];

  for (const [person, list] of groupByPerson(samples)) {
    /* 🔴 모드와 무관하게 **앞 shotsPerPerson 장을 등록 몫으로 떼어냅니다.**
       `single` 만 1 장을 떼면 검표 시도가 그만큼 많아져서, 모드를 바꿨을 때
       달라진 것이 등록 방식 때문인지 표본 수 때문인지 알 수 없게 됩니다. */
    const reserved = list.slice(0, shotsPerPerson);
    if (reserved.length === 0) continue;

    if (mode === 'multi') {
      // 찍은 그대로 전부 저장 — 티켓당 N 행
      reserved.forEach((shot, index) =>
        templates.push({ ...shot, fileName: `${person} · 등록 ${index + 1}` }),
      );
    } else {
      // single 은 첫 장만, centroid 는 떼어낸 전부를 평균
      const used = mode === 'single' ? reserved.slice(0, 1) : reserved;
      templates.push({
        person,
        fileName: `${person} · 등록 ${used.length}장`,
        embedding: centroidOf(used.map((shot) => shot.embedding)),
      });
    }

    /* 등록에 쓴 장은 검표 시도에서 뺍니다. 안 빼면 자기 자신과 비교해
       유사도 1.0 이 나와 **모든 임계값이 완벽해 보입니다.** */
    const rest = list.slice(shotsPerPerson);
    if (rest.length === 0) probelessPeople.push(person);
    else probes.push(...rest);
  }

  return { templates, probes, probelessPeople };
}

/**
 * 검표 시도 단위로 묶습니다. {@code bestOfN} 장씩 한 번의 시도입니다.
 *
 * <p>1 이면 한 장만 보고 판정하는 셈이고, 올리면 서버가 실제로 하는 best-of-N 이 됩니다.
 * 이 값을 바꿔 가며 보면 <b>여러 장 보내는 게 얼마나 효과가 있는지</b> 가 숫자로 나옵니다.
 */
export function groupProbes(
  probes: readonly BenchSample[],
  bestOfN: number,
): BenchSample[][] {
  const groups: BenchSample[][] = [];

  for (const list of groupByPerson(probes).values()) {
    for (let i = 0; i < list.length; i += bestOfN) {
      groups.push(list.slice(i, i + bestOfN));
    }
  }

  return groups;
}

function ratio(values: readonly number[], matches: (value: number) => boolean): number {
  if (values.length === 0) return 0;

  let hits = 0;
  for (const value of values) if (matches(value)) hits += 1;
  return hits / values.length;
}
