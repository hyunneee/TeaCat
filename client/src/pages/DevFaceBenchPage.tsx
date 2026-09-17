import { Camera } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import { env } from '@/shared/config';
import {
  CameraStage,
  BENCH_STEPS,
  SFACE_COSINE_THRESHOLD,
  useAutoShutter,
  useCamera,
  useFaceBench,
  useFaceGuide,
} from '@/features/face';
import type { Distribution, EnrollMode } from '@/features/face';

/**
 * 🛠 **개발용** 임계값 실측 화면. (`/dev/face-bench`)
 *
 * `gate.threshold.{match,review,margin}` 에 넣을 숫자를 정하는 곳입니다. 서버에 들어 있는
 * 0.70 / 0.55 / 0.05 는 **근거 없는 자리 채우기**라, 여기서 재서 바꿔야 게이트를 켤 수
 * 있습니다. (GATE_PLAN.md 8-3)
 *
 * <p>사진 3장을 비교하는 `/dev/face` 와 하는 일이 다릅니다 — 저쪽은 "파이프라인이 도는가",
 * 여기는 "몇 점으로 끊을 것인가" 입니다.
 *
 * ── 서버로 아무것도 보내지 않습니다 ───────────────────────
 * 파일은 브라우저 안에서만 열리고, **미리보기조차 만들지 않습니다.** 수십 장을 다루는
 * 화면이라 썸네일을 붙이면 얼굴 이미지가 메모리에 계속 남습니다. 파일명과 숫자만 남깁니다.
 *
 * ⚠️ 운영 번들에는 들어가지 않습니다 (router 에서 IS_DEV_BUILD 로 걸러집니다).
 */
export function DevFaceBenchPage() {
  const bench = useFaceBench();
  const camera = useCamera();
  const { gate, split, thresholds } = bench;

  const { capture } = bench;
  const session = capture.session;

  const engineReady = bench.engine.state === 'ready';
  const guide = useFaceGuide(bench.engine, camera.videoRef.current, camera.active);
  const guidePassed = camera.active && engineReady && guide.issue === null;

  /* 🔴 이번 단계의 지시를 지켰는지 봅니다. 통과해야만 셔터가 겨눕니다 —
     지시만 하고 검증을 안 하면 가만히 있어도 찍혀서 같은 프레임만 쌓입니다. */
  const step = capture.checkStep(guide.faces);

  /* 등록 화면과 **같은 훅**입니다 — 자세가 잡히면 스스로 찍습니다.
     버튼을 누르는 순간 손가락이 움직여 그 흔들림이 프레임에 남기 때문입니다.
     `preparing` 동안은 겨누지 않습니다 — 자세를 바꿀 틈입니다. */
  const shutter = useAutoShutter({
    armed: Boolean(session) && !session?.preparing && !capture.capturing,
    ready: guidePassed && step.ok,
    onFire: () => {
      const video = camera.videoRef.current;
      if (video) void capture.capture(video);
    },
  });

  const reviewTotal = gate.reviewCorrect + gate.reviewWrong;

  return (
    <>
      <Header title="임계값 실측 (개발용)" showBack />

      <div className="space-y-5 p-4">
        {/* ── 안내 ── */}
        <section className="surface-2 space-y-2 rounded-2xl p-4 text-xs">
          <p className="text-ink text-[0.8125rem] font-bold">
            엔진: {engineLabel(bench.engine.state)}
          </p>
          {bench.engine.error && <p className="text-danger">{bench.engine.error}</p>}
          <p className="text-muted break-all">modelVersion: {env.face.modelVersion}</p>
          <p className="text-subtle leading-relaxed">
            <b>한 사람씩 차례로 찍습니다.</b> 이름은 받지 않습니다 — 촬영 한 번이 사람 하나이고
            번호가 자동으로 붙습니다. 같은 사람을 조명·거리를 바꿔 더 찍으려면 아래의
            <b> 더 찍기</b> 를 쓰세요.
          </p>
          <p className="text-subtle leading-relaxed">
            🔴 <b>사람이 많을수록 좋습니다 — 최소 8명.</b> 2~3명으로 잰 숫자는 현장에서 안
            맞습니다. 후보가 늘수록 "남인데 우연히 닮은 사람" 이 나올 확률이 커지기 때문입니다.
          </p>
        </section>

        {/* ── 카메라로 바로 찍기 ── */}
        <section className="surface shadow-card space-y-3 rounded-2xl p-4">
          <div>
            <p className="text-sm font-bold">카메라로 바로 찍기</p>
            <p className="text-subtle text-xs leading-relaxed">
              현장과 같은 조건입니다 — 웹캠 · 같은 품질 게이트 · 같은 파이프라인. 폰으로 찍은
              사진보다 이쪽 숫자가 실제에 가깝습니다.
            </p>
          </div>

          <CameraStage
            videoRef={camera.videoRef}
            active={camera.active}
            faces={guide.faces}
            ready={guidePassed}
            progress={shutter.progress}
            placeholder="카메라를 켜고 한 사람씩 찍습니다"
          />

          {camera.error && <p className="text-danger text-xs">{camera.error.message}</p>}

          {session ? (
            <div className="surface-2 space-y-2 rounded-xl p-3 text-center">
              {session.preparing && (
                <p className="text-subtle text-[0.6875rem]">자세를 바꿔주세요 — 다음</p>
              )}
              <p className="text-ink text-base font-bold">{session.prompt}</p>
              <p className="text-muted text-xs tabular-nums">
                {bench.person} · {session.taken} / {session.total}장
              </p>
              {/* 안내는 한 줄만 — 품질(얼굴이 제대로 보이나) 이 자세보다 먼저입니다 */}
              <p
                className={cn(
                  'text-xs',
                  session.preparing
                    ? 'text-muted'
                    : guide.issue || !step.ok
                      ? 'text-danger'
                      : 'text-accent-700',
                )}
              >
                {session.preparing
                  ? '잠시 후 자동으로 찍어요'
                  : (guide.issue?.message ??
                    (step.ok ? '좋아요, 그대로 — 곧 찍어요' : (step.hint ?? '지시대로 맞춰주세요')))}
              </p>
              <Button variant="soft" size="sm" fullWidth onClick={bench.stopSession}>
                중지
              </Button>
            </div>
          ) : (
            <>
              <p
                role="status"
                aria-live="polite"
                className={cn('text-center text-sm', capture.issue ? 'text-danger' : 'text-muted')}
              >
                {capture.issue ?? '카메라를 켜고 한 사람씩 찍으세요'}
              </p>

              {camera.active ? (
                <>
                  {/* 이름을 받지 않습니다 — 세션 하나가 사람 하나이고 번호는 자동입니다 */}
                  <Button
                    fullWidth
                    leftIcon={<Camera size={16} />}
                    disabled={!engineReady}
                    onClick={() => bench.startSession(false)}
                  >
                    다음 사람 · {BENCH_STEPS.length}장 촬영
                  </Button>

                  {bench.lastPerson && (
                    <Button
                      variant="soft"
                      fullWidth
                      disabled={!engineReady}
                      onClick={() => bench.startSession(true)}
                    >
                      {bench.lastPerson} 더 찍기 (조명·거리 바꿔서)
                    </Button>
                  )}
                </>
              ) : (
                <Button fullWidth loading={camera.starting} onClick={() => void camera.start()}>
                  카메라 켜기
                </Button>
              )}

              {camera.active && (
                <Button variant="ghost" size="sm" fullWidth onClick={camera.stop}>
                  카메라 끄기
                </Button>
              )}
            </>
          )}

          <p className="text-subtle border-line border-t pt-3 text-xs leading-relaxed">
            🔴 <b>같은 자세로만 찍으면 안 됩니다.</b> 거의 같은 프레임이 모이면 같은 사람
            유사도가 0.99 로 떠서, 실제로는 통과 못 할 임계값도 통과해 보입니다. 화면의 지시대로
            조금씩 움직이세요. <b>같은 사람을 조명을 바꿔 여러 번</b> 찍으면 더 좋습니다.
          </p>
        </section>


        {/* ── 사람별 장수 ── */}
        {bench.people.size > 0 && (
          <section className="surface shadow-card space-y-2 rounded-2xl p-4">
            <p className="text-sm font-bold">사람별 장수</p>
            <div className="flex flex-wrap gap-1.5">
              {[...bench.people].map(([person, list]) => (
                <span
                  key={person}
                  className={cn(
                    'rounded-lg px-2 py-1 text-xs tabular-nums',
                    list.length > bench.shotsPerPerson
                      ? 'surface-2 text-muted'
                      : 'bg-danger/10 text-danger font-bold',
                  )}
                >
                  {person} {list.length}장
                </span>
              ))}
            </div>
            {split.probelessPeople.length > 0 && (
              <p className="text-danger text-xs leading-relaxed">
                🔴 {split.probelessPeople.join(', ')} — 사진을 전부 등록에 써서 시험할 게
                없습니다. 등록 장수를 줄이거나 사진을 더 넣으세요.
              </p>
            )}
          </section>
        )}

        {/* ── 1:1 분포 ── */}
        {bench.genuine && bench.impostor && (
          <section className="surface shadow-card space-y-3 rounded-2xl p-4">
            <p className="text-sm font-bold">1:1 분포 — 모든 쌍</p>
            <DistributionRow label="같은 사람" data={bench.genuine} />
            <DistributionRow label="다른 사람" data={bench.impostor} highlightMax />
            <p className="text-subtle border-line border-t pt-3 text-xs leading-relaxed">
              🔴 <b>다른 사람의 최댓값</b>이 가장 중요한 숫자입니다. 통과선이 이 값보다 낮으면
              남이 들어옵니다. 같은 사람의 최솟값이 그보다 아래면, 어떤 값을 골라도 둘 중
              하나는 틀립니다 — 그때는 임계값이 아니라 <b>촬영 품질</b>을 고쳐야 합니다.
            </p>
            <p className="text-subtle text-xs">
              SFace 공식 임계값 {SFACE_COSINE_THRESHOLD} · 1:1 본인확인은 0.65
            </p>
          </section>
        )}

        {/* ── FRR / FAR ── */}
        {bench.eer && (
          <section className="surface shadow-card space-y-2 rounded-2xl p-4">
            <p className="text-sm font-bold">오류율</p>
            <Line
              label="EER (두 오류가 만나는 점)"
              value={`${bench.eer.threshold.toFixed(2)} · ${percent(bench.eer.frr)}`}
            />
            <Line
              label="오인 통과가 0 이 되는 최저 임계값"
              value={
                bench.zeroFar
                  ? `${bench.zeroFar.threshold.toFixed(2)} · 본인 거절 ${percent(bench.zeroFar.frr)}`
                  : '이 데이터에선 없음'
              }
            />
            <p className="text-subtle border-line border-t pt-3 text-xs leading-relaxed">
              입장 통제에서는 두 오류의 값이 다릅니다. 남을 들여보내는 쪽이 본인을 한 번 더
              찍게 하는 쪽보다 훨씬 비쌉니다 — <b>오인 통과 0 을 먼저 맞추고</b>, 거기서
              본인 거절이 몇 %인지 보세요.
            </p>
          </section>
        )}

        {/* ── 1:N 게이트 시뮬레이션 ── */}
        {split.templates.length > 0 && (
          <section className="surface shadow-card space-y-4 rounded-2xl p-4">
            <div>
              <p className="text-sm font-bold">1:N 게이트 시뮬레이션</p>
              <p className="text-subtle text-xs leading-relaxed">
                서버의 판정 규칙(<code>GateVerifyService</code>)을 그대로 돌립니다. 등록해 둔
                {' '}{split.templates.length}명 중에서 찾습니다.
              </p>
            </div>

            <Slider
              label="통과선 (match)"
              value={thresholds.match}
              min={0.3}
              max={0.95}
              onChange={(match) => bench.setThresholds({ ...thresholds, match })}
            />
            <Slider
              label="보류선 (review)"
              value={thresholds.review}
              min={0.2}
              max={0.9}
              onChange={(review) => bench.setThresholds({ ...thresholds, review })}
            />
            <Slider
              label="1등−2등 마진 (margin)"
              value={thresholds.margin}
              min={0}
              max={0.3}
              onChange={(margin) => bench.setThresholds({ ...thresholds, margin })}
            />

            <div className="space-y-1">
              <p className="text-subtle text-[0.6875rem]">
                티켓에 무엇을 저장할까 — <b>이 선택이 곧 DB 스키마입니다</b>
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {ENROLL_MODES.map(({ value, label, hint }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => bench.setEnrollMode(value)}
                    className={cn(
                      'rounded-xl px-2 py-2 text-xs leading-tight transition-colors',
                      bench.enrollMode === value
                        ? 'surface-strong font-bold'
                        : 'surface-2 text-muted',
                    )}
                  >
                    {label}
                    <span className="block text-[0.625rem] font-normal opacity-70">{hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Counter
                label={bench.enrollMode === 'single' ? '등록 장수 (미사용)' : '등록 장수'}
                value={bench.shotsPerPerson}
                onChange={bench.setShotsPerPerson}
                max={8}
              />
              <Counter label="한 번에 보낼 장수 (best-of-N)" value={bench.bestOfN} onChange={bench.setBestOfN} />
            </div>

            <div className="border-line space-y-2 border-t pt-3">
              <Line label={`검표 시도 ${gate.trials}회`} value="" />
              <Outcome label="본인 통과" count={gate.correctAdmit} total={gate.trials} tone="good" />
              <Outcome
                label="🔴 남을 통과"
                count={gate.wrongAdmit}
                total={gate.trials}
                tone={gate.wrongAdmit > 0 ? 'bad' : 'good'}
              />
              <Outcome label="보류 (후보가 맞음)" count={gate.reviewCorrect} total={gate.trials} tone="neutral" />
              <Outcome label="보류 (후보가 틀림)" count={gate.reviewWrong} total={gate.trials} tone="neutral" />
              <Outcome label="본인 거절" count={gate.reject} total={gate.trials} tone="warn" />
            </div>

            <p className="text-subtle text-xs leading-relaxed">
              <b>남을 통과가 0 이 되는 가장 낮은 값</b>을 찾고, 거기서 본인 거절과 보류가
              운영할 만한지 보세요. 보류는 실패가 아닙니다 — 운영자가 {reviewTotal}건을
              눈으로 확인한다는 뜻이고, 입구에 사람이 이미 서 있습니다.
            </p>

            <pre className="surface-2 overflow-x-auto rounded-xl p-3 text-[0.6875rem] leading-relaxed">
              {yamlSnippet(thresholds)}
            </pre>
          </section>
        )}

        {bench.samples.length > 0 && (
          <Button variant="soft" fullWidth onClick={bench.reset}>
            초기화
          </Button>
        )}
      </div>
    </>
  );
}

/**
 * 티켓에 무엇을 저장할지. 고른 것이 그대로 스키마가 됩니다.
 *
 * 🔴 `multi` 는 티켓 하나에 여러 벡터를 저장하므로 **생체정보가 티켓당 N 배**가 됩니다.
 *    파기 범위도 그만큼 늘어납니다 (server/CLAUDE.md 6장).
 */
const ENROLL_MODES: { value: EnrollMode; label: string; hint: string }[] = [
  { value: 'single', label: '1개', hint: '지금 운영' },
  { value: 'centroid', label: '평균 1개', hint: '칸 그대로' },
  { value: 'multi', label: 'N개 전부', hint: '표 추가' },
];

function engineLabel(state: string) {
  if (state === 'ready') return '준비됨';
  if (state === 'loading') return '모델 불러오는 중…';
  if (state === 'failed') return '실패';
  return '대기';
}

function percent(ratio: number) {
  return `${(ratio * 100).toFixed(1)}%`;
}

function yamlSnippet({ match, review, margin }: { match: number; review: number; margin: number }) {
  return `# server/src/main/resources/application.yaml
gate:
  threshold:
    match: \${GATE_THRESHOLD_MATCH:${match.toFixed(2)}}
    review: \${GATE_THRESHOLD_REVIEW:${review.toFixed(2)}}
    margin: \${GATE_THRESHOLD_MARGIN:${margin.toFixed(2)}}`;
}

function DistributionRow({
  label,
  data,
  highlightMax,
}: {
  label: string;
  data: Distribution;
  highlightMax?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="text-subtle text-xs">{data.count}쌍</span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center text-xs tabular-nums">
        <Cell caption="최소" value={data.min} />
        <Cell caption="중앙" value={data.p50} />
        <Cell caption="상위5%" value={data.p95} />
        <Cell caption="최대" value={data.max} strong={highlightMax} />
      </div>
    </div>
  );
}

function Cell({ caption, value, strong }: { caption: string; value: number; strong?: boolean }) {
  return (
    <div className="surface-2 rounded-lg py-1.5">
      <p className="text-subtle text-[0.625rem]">{caption}</p>
      <p className={cn('text-ink', strong && 'text-danger font-bold')}>{value.toFixed(3)}</p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted min-w-0 flex-1">{label}</span>
      <span className="text-ink shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

function Outcome({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: 'good' | 'bad' | 'warn' | 'neutral';
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted min-w-0 flex-1">{label}</span>
      <span
        className={cn(
          'shrink-0 tabular-nums',
          tone === 'bad' && 'text-danger font-bold',
          tone === 'good' && count > 0 && 'text-accent-700 font-bold',
          tone === 'warn' && count > 0 && 'text-ink',
        )}
      >
        {count}
        <span className="text-subtle ml-1 text-xs">
          {total > 0 ? `${((count / total) * 100).toFixed(0)}%` : '—'}
        </span>
      </span>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="text-ink font-bold tabular-nums">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-accent-700 w-full"
      />
    </label>
  );
}

function Counter({
  label,
  value,
  onChange,
  min = 1,
  max = 5,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="surface-2 space-y-1 rounded-xl p-2.5">
      <p className="text-subtle text-[0.6875rem] leading-tight">{label}</p>
      <div className="flex items-center gap-2">
        <Button variant="soft" size="sm" onClick={() => onChange(Math.max(min, value - 1))}>
          −
        </Button>
        <span className="text-ink flex-1 text-center text-sm font-bold tabular-nums">{value}</span>
        <Button variant="soft" size="sm" onClick={() => onChange(Math.min(max, value + 1))}>
          +
        </Button>
      </div>
    </div>
  );
}
