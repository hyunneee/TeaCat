import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import { env } from '@/shared/config';
import {
  SFACE_COSINE_THRESHOLD,
  cosineSimilarity,
  useFaceEngine,
} from '@/features/face';

/**
 * 🛠 **개발용** 얼굴 인식 검증 화면. (`/dev/face`)
 *
 * 사진 세 장을 넣어 코사인 유사도를 눈으로 확인합니다.
 * 카메라 없이 파일만으로 파이프라인 전체(검출 → 5점 정렬 → SFace → 코사인)를 검증합니다.
 *
 * ── 이 화면도 서버로 아무것도 보내지 않습니다 ─────────────
 * 파일은 브라우저 안에서만 열리고, 임베딩도 화면에 숫자로만 남습니다.
 * 미리보기용 `createObjectURL` 은 **바뀔 때·떠날 때 반드시 revoke** 합니다.
 *
 * ⚠️ 운영 번들에는 들어가지 않습니다 (router 에서 env.isDev 로 걸러집니다).
 */

type SlotId = 'a1' | 'a2' | 'b';

const SLOTS: { id: SlotId; label: string; hint: string }[] = [
  { id: 'a1', label: 'A-1', hint: '같은 사람 · 첫 번째' },
  { id: 'a2', label: 'A-2', hint: '같은 사람 · 두 번째' },
  { id: 'b', label: 'B', hint: '다른 사람' },
];

interface Slot {
  previewUrl: string;
  fileName: string;
  embedding: Float32Array | null;
  faces: number;
  sharpness: number;
  brightness: number;
  ms: number;
  error?: string;
}

/** 기대값 — 사용자가 제시한 합격선 */
const EXPECT_SAME_MIN = 0.6;
const EXPECT_DIFF_MAX = 0.3;

export function DevFacePage() {
  /* 엔진은 이 화면에 들어오면 바로 켭니다 (카메라를 안 쓰므로 켤 계기가 없습니다) */
  const engine = useFaceEngine(true);

  const [slots, setSlots] = useState<Partial<Record<SlotId, Slot>>>({});
  const [busy, setBusy] = useState<SlotId | null>(null);

  /* 만든 objectURL 을 전부 기억해 떠날 때 정리합니다 (누수 방지) */
  const urlsRef = useRef(new Set<string>());
  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const load = async (id: SlotId, file: File) => {
    setBusy(id);

    // 이 칸에 있던 미리보기는 여기서 놓아줍니다.
    const previous = slots[id]?.previewUrl;
    if (previous) {
      URL.revokeObjectURL(previous);
      urlsRef.current.delete(previous);
    }

    const previewUrl = URL.createObjectURL(file);
    urlsRef.current.add(previewUrl);

    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
      const started = performance.now();
      const result = await engine.embed(bitmap);
      const ms = Math.round(performance.now() - started);

      setSlots((prev) => ({
        ...prev,
        [id]:
          'error' in result
            ? {
                previewUrl,
                fileName: file.name,
                embedding: null,
                faces: 0,
                sharpness: 0,
                brightness: 0,
                ms,
                error: result.error,
              }
            : {
                previewUrl,
                fileName: file.name,
                embedding: result.embedding,
                faces: result.faces.length,
                sharpness: Math.round(result.sharpness),
                brightness: Math.round(result.brightness),
                ms,
                error: result.embedding ? undefined : '얼굴이 1개가 아니라 임베딩을 건너뜀',
              },
      }));
    } catch (error) {
      setSlots((prev) => ({
        ...prev,
        [id]: {
          previewUrl,
          fileName: file.name,
          embedding: null,
          faces: 0,
          sharpness: 0,
          brightness: 0,
          ms: 0,
          error: error instanceof Error ? error.message : '이미지를 열지 못했습니다',
        },
      }));
    } finally {
      // embed 에 넘긴 비트맵은 워커가 닫습니다. 여기서 만든 건 별개라 직접 닫습니다.
      bitmap?.close();
      setBusy(null);
    }
  };

  const pair = (x?: Slot, y?: Slot) =>
    x?.embedding && y?.embedding ? cosineSimilarity(x.embedding, y.embedding) : null;

  const sameScore = pair(slots.a1, slots.a2);
  const diffScores = [pair(slots.a1, slots.b), pair(slots.a2, slots.b)];

  return (
    <>
      <Header title="얼굴 인식 검증 (개발용)" showBack />

      <div className="space-y-5 p-4">
        <div className="surface-2 space-y-1 rounded-2xl p-4 text-xs">
          <p className="text-ink text-[0.8125rem] font-bold">
            엔진 상태:{' '}
            {engine.state === 'ready'
              ? '준비됨'
              : engine.state === 'loading'
                ? '모델 불러오는 중…'
                : engine.state === 'failed'
                  ? '실패'
                  : '대기'}
          </p>
          {engine.error && <p className="text-danger">{engine.error}</p>}
          <p className="text-muted break-all">modelVersion: {env.face.modelVersion}</p>
          <p className="text-muted">
            SFace 공식 임계값 {SFACE_COSINE_THRESHOLD} · 기대 합격선 같은 사람 ≥{' '}
            {EXPECT_SAME_MIN} / 다른 사람 ≤ {EXPECT_DIFF_MAX}
          </p>
        </div>

        {/* 사진 세 칸 */}
        <div className="grid grid-cols-3 gap-3">
          {SLOTS.map(({ id, label, hint }) => {
            const slot = slots[id];

            return (
              <label key={id} className="flex cursor-pointer flex-col gap-1.5">
                <span className="text-ink text-xs font-bold">{label}</span>
                <span className="text-subtle text-[0.6875rem] leading-tight">{hint}</span>

                <span className="surface-2 relative flex aspect-square items-center justify-center overflow-hidden rounded-xl">
                  {slot ? (
                    <img
                      src={slot.previewUrl}
                      alt={`${label} 미리보기`}
                      className="size-full object-cover"
                    />
                  ) : (
                    <Upload size={20} className="text-subtle" />
                  )}
                  {busy === id && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[0.6875rem] text-white">
                      분석 중
                    </span>
                  )}
                </span>

                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={engine.state !== 'ready' || busy !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void load(id, file);
                    e.target.value = '';
                  }}
                />

                {slot && (
                  <span className="text-[0.625rem] leading-tight">
                    {slot.error ? (
                      <span className="text-danger">{slot.error}</span>
                    ) : (
                      <span className="text-muted">
                        얼굴 {slot.faces} · 선명 {slot.sharpness} · 밝기 {slot.brightness}
                        <br />
                        {slot.embedding?.length}차원 · {slot.ms}ms
                      </span>
                    )}
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {/* 결과 */}
        <div className="surface shadow-card space-y-3 rounded-2xl p-4">
          <p className="text-sm font-bold">코사인 유사도</p>

          <Row
            label="A-1 ↔ A-2 (같은 사람)"
            value={sameScore}
            pass={sameScore === null ? null : sameScore >= EXPECT_SAME_MIN}
            note={`기대 ≥ ${EXPECT_SAME_MIN}`}
          />
          <Row
            label="A-1 ↔ B (다른 사람)"
            value={diffScores[0] ?? null}
            pass={diffScores[0] == null ? null : diffScores[0] <= EXPECT_DIFF_MAX}
            note={`기대 ≤ ${EXPECT_DIFF_MAX}`}
          />
          <Row
            label="A-2 ↔ B (다른 사람)"
            value={diffScores[1] ?? null}
            pass={diffScores[1] == null ? null : diffScores[1] <= EXPECT_DIFF_MAX}
            note={`기대 ≤ ${EXPECT_DIFF_MAX}`}
          />

          <p className="text-subtle border-line border-t pt-3 text-xs leading-relaxed">
            SFace 는 공식 임계값이 <b>0.363</b> 입니다. 같은 사람이 0.4~0.7 사이로 나오는 게
            정상이고, 0.6 을 못 넘어도 0.363 을 넘으면 모델 기준으로는 통과입니다.
          </p>
        </div>

        <Button
          variant="soft"
          fullWidth
          onClick={() => {
            urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            urlsRef.current.clear();
            setSlots({});
          }}
        >
          초기화
        </Button>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  pass,
  note,
}: {
  label: string;
  value: number | null;
  pass: boolean | null;
  note: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted min-w-0 flex-1 truncate">{label}</span>
      <span className="text-subtle shrink-0 text-xs">{note}</span>
      <span
        className={cn(
          'shrink-0 tabular-nums',
          value === null ? 'text-subtle' : pass ? 'text-accent-700 font-bold' : 'text-danger font-bold',
        )}
      >
        {value === null ? '—' : value.toFixed(4)}
      </span>
    </div>
  );
}
