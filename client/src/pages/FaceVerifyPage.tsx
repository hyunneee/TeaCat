import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Camera, CheckCircle2, FlaskConical, TriangleAlert, XCircle } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button, Card } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';
import { cn } from '@/shared/lib';
import { useAuth } from '@/features/auth';
import {
  CameraStage,
  FACE_GUIDE_IDLE,
  FACE_GUIDE_READY,
  checkFaceQuality,
  useCamera,
  useFaceEngine,
  useFaceGuide,
  useFaceVerify,
} from '@/features/face';

/** 티켓 상세에서 넘어왔으면 돌아갈 곳을 들고 옵니다 */
interface VerifyLocationState {
  from?: string;
}

/**
 * 본인 확인 (검증용).
 *
 * 카메라에 잡힌 얼굴이 **등록해 둔 내 얼굴과 같은 사람인지** 대조합니다.
 * 얼굴 등록 화면과 카메라·검출·임베딩을 그대로 공유하고, 마지막 한 걸음만 다릅니다 —
 * 등록은 특징값을 저장하고, 여기는 저장된 것과 비교합니다.
 *
 * 🔴 **판정은 서버가 합니다.** 저장된 임베딩은 브라우저로 내려오지 않습니다.
 *    화면에 유사도 점수가 보이는 건 임계값을 맞춰보는 **검증 단계**이기 때문입니다.
 *
 * ⚠️ **아직 입장 처리가 아닙니다.** 확인만 하고 티켓 상태는 바꾸지 않습니다.
 *    게이트 검표가 생기면 그때 티켓을 사용 처리하는 API 를 붙입니다.
 *
 * 🔴 사진을 올리는 입력을 여기 추가하지 마세요 — 남의 사진으로 통과할 수 있게 됩니다.
 *    (CLAUDE.md 7장)
 */
export function FaceVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const camera = useCamera();
  /* 등록 화면과 같은 이유로 카메라를 켤 때 모델을 받습니다 (FaceRegisterPage 주석) */
  const [engineWanted, setEngineWanted] = useState(false);
  const engine = useFaceEngine(engineWanted);
  const verify = useFaceVerify();

  const guide = useFaceGuide(engine, camera.videoRef.current, camera.active);
  const [capturing, setCapturing] = useState(false);
  const [captureIssue, setCaptureIssue] = useState<string | null>(null);

  const engineReady = engine.state === 'ready';
  const guidePassed = camera.active && engineReady && guide.issue === null;
  const busy = capturing || verify.isPending;
  const result = verify.data;

  const backTo = (location.state as VerifyLocationState | null)?.from;

  const handleCapture = async () => {
    const video = camera.videoRef.current;
    if (!video) return;

    setCaptureIssue(null);
    verify.reset();
    setCapturing(true);
    try {
      const shot = await engine.embed(video);

      if ('error' in shot) {
        setCaptureIssue(shot.error);
        return;
      }

      /* 대조 전에 품질을 먼저 봅니다. 흐릿하거나 어두운 사진은 같은 사람이어도
         점수가 떨어져서, 그대로 보내면 "본인이 아님" 으로 읽히는 오답이 됩니다 */
      const issue = checkFaceQuality(shot.faces, {
        sharpness: shot.sharpness,
        brightness: shot.brightness,
      });
      if (issue || !shot.embedding) {
        setCaptureIssue(issue?.message ?? '얼굴을 인식하지 못했어요. 다시 시도해 주세요.');
        return;
      }

      verify.mutate(shot.embedding);
    } finally {
      setCapturing(false);
    }
  };

  /* 얼굴을 등록하지 않았으면 대조할 상대가 없습니다. 카메라를 켜기 전에 막습니다 */
  if (user && !user.faceRegistered) {
    return (
      <>
        <Header title="본인 확인" showBack />
        <div className="space-y-4 p-4">
          <Card tone="warning" className="space-y-1">
            <p className="text-sm font-bold">등록된 얼굴이 없어요</p>
            <p className="text-muted text-xs leading-relaxed">
              비교할 얼굴이 있어야 본인 확인을 할 수 있어요. 먼저 얼굴을 등록해 주세요.
            </p>
          </Card>
          <Button variant="dark" size="lg" fullWidth onClick={() => navigate(ROUTES.FACE_REGISTER)}>
            얼굴 등록하러 가기
          </Button>
        </div>
      </>
    );
  }

  const message =
    captureIssue ??
    camera.error?.message ??
    (engine.state === 'failed' ? engine.error : null) ??
    (!camera.active ? null : !engineReady ? '얼굴 인식을 준비하고 있어요…' : null) ??
    guide.issue?.message ??
    (guidePassed ? FACE_GUIDE_READY : FACE_GUIDE_IDLE);

  const problem = Boolean(captureIssue || camera.error || engine.state === 'failed');

  return (
    <>
      <Header title="본인 확인" showBack />

      <div className="space-y-4 p-4">
        {/* 지금 무엇을 하는 화면인지 먼저 말합니다 — 입장 처리로 오해하면 안 됩니다 */}
        <Card className="flex gap-3">
          <FlaskConical size={22} className="text-ink-muted shrink-0" />
          <div className="space-y-1 text-xs">
            <p className="text-[0.8125rem] font-bold">본인 확인 테스트</p>
            <p className="text-muted leading-relaxed">
              카메라에 잡힌 얼굴이 등록해 둔 얼굴과 같은 사람인지만 확인합니다. 사진은 기기 밖으로
              나가지 않고, 대조는 서버가 합니다. <b>티켓 상태는 바뀌지 않아요.</b>
            </p>
          </div>
        </Card>

        {result ? (
          /* ── 결과 ──────────────────────────────────────
             점수와 합격선을 같이 보여줍니다. 붙었는지만 알려주면
             임계값이 빡빡한지 헐거운지 판단할 수 없습니다. */
          <>
            <Card
              tone={result.match ? 'brand' : 'danger'}
              className="flex flex-col items-center gap-3 py-7 text-center"
            >
              {result.match ? (
                <CheckCircle2 size={44} className="text-accent-700" />
              ) : (
                <XCircle size={44} className="text-danger" />
              )}
              <div className="space-y-1">
                <p className="text-lg font-extrabold">
                  {result.match ? '본인이 맞아요' : '다른 사람으로 보여요'}
                </p>
                <p className="text-muted text-sm">
                  {result.match
                    ? '등록된 얼굴과 같은 사람으로 확인됐어요.'
                    : '등록된 얼굴과 충분히 닮지 않았어요.'}
                </p>
              </div>
            </Card>

            <Card padded={false} className="overflow-hidden">
              <dl className="divide-line divide-y text-sm">
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-muted">유사도</dt>
                  <dd className="font-mono text-base font-bold tabular-nums">
                    {result.similarity.toFixed(4)}
                  </dd>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-muted">합격선</dt>
                  <dd className="font-mono tabular-nums">{result.threshold.toFixed(3)}</dd>
                </div>
              </dl>
            </Card>

            {/* "여러 번 찍어보세요" 라고 쓰지 않습니다 — 결과 화면에 재시도 버튼이 없습니다.
                붙을 때까지 다시 누르게 하면 본인 확인이 아니라 임계값 넘기기 연습이 됩니다. */}
            <p className="text-subtle px-1 text-xs leading-relaxed">
              같은 사람도 조명·각도·거리에 따라 점수가 흩어집니다. 합격선을 넘지 못했다면 밝은
              곳에서 정면으로 다시 시도해 주세요.
            </p>

            {/* 결과를 받은 뒤에는 **다시 찍지 못하게** 둡니다.
                재시도 버튼이 있으면 붙을 때까지 각도·조명을 바꿔가며 누르게 되고,
                그건 본인 확인이 아니라 임계값을 넘기는 연습이 됩니다.
                다시 하려면 화면을 나갔다 들어와야 합니다(헤더의 뒤로가기). */}
            {backTo && (
              <Button variant="dark" size="lg" fullWidth onClick={() => navigate(backTo)}>
                티켓으로 돌아가기
              </Button>
            )}
          </>
        ) : (
          /* ── 촬영 ────────────────────────────────────── */
          <>
            <CameraStage
              videoRef={camera.videoRef}
              active={camera.active}
              faces={guide.faces}
              ready={guidePassed}
              placeholder={camera.error ? undefined : '카메라를 켜고 얼굴을 화면 안에 맞춰주세요'}
            />

            <p
              role="status"
              aria-live="polite"
              className={cn(
                'flex items-start justify-center gap-1.5 px-2 text-center text-sm',
                problem ? 'text-danger' : 'text-muted',
              )}
            >
              {problem && <TriangleAlert size={14} className="mt-0.5 shrink-0" />}
              <span>{message}</span>
            </p>

            {camera.active ? (
              <Button
                variant="dark"
                size="lg"
                fullWidth
                leftIcon={<Camera size={18} />}
                loading={busy}
                disabled={!guidePassed}
                onClick={() => void handleCapture()}
              >
                {verify.isPending
                  ? '대조하는 중'
                  : capturing
                    ? '얼굴을 확인하는 중'
                    : '촬영해서 확인하기'}
              </Button>
            ) : (
              <Button
                variant="dark"
                size="lg"
                fullWidth
                loading={camera.starting}
                onClick={() => {
                  setEngineWanted(true);
                  void camera.start();
                }}
              >
                카메라 켜기
              </Button>
            )}
          </>
        )}
      </div>
    </>
  );
}
