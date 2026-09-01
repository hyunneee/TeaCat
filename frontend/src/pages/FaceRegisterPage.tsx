import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ShieldCheck, TriangleAlert } from 'lucide-react';
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
  useFaceRegistration,
} from '@/features/face';

/**
 * 얼굴 등록.
 *
 * 티켓이 유효하려면(입장하려면) 얼굴 등록이 선행돼야 합니다. 한 번만 하면 됩니다.
 *
 * 🔴 이 화면은 **사진을 서버로 보내지 않습니다.** 브라우저에서 특징값(임베딩)만 뽑아
 *    그 숫자만 전송합니다. 사진 업로드 입력을 여기 추가하지 마세요 —
 *    남의 사진으로 등록할 수 있게 되고, 그건 이 서비스의 목적과 정반대입니다.
 *    (CLAUDE.md 7장 생체정보 처리 규칙)
 *
 * 페이지는 조립만 합니다 — 카메라·검출·임베딩은 전부 features/face 안에 있습니다.
 */
export function FaceRegisterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const camera = useCamera();
  /* 모델(4.5MB)은 **카메라를 켤 때부터** 받습니다. 화면만 들어왔다 나가는 사람의
     데이터를 쓰지 않기 위해서입니다. 권한 팝업이 뜨는 동안 같이 받아 체감 지연이 없습니다. */
  const [engineWanted, setEngineWanted] = useState(false);
  const engine = useFaceEngine(engineWanted);
  const registration = useFaceRegistration();

  const guide = useFaceGuide(engine, camera.videoRef.current, camera.active);
  const [capturing, setCapturing] = useState(false);
  /** 캡처 시점에만 알 수 있는 실패 사유 (흔들림·어두움 등) */
  const [captureIssue, setCaptureIssue] = useState<string | null>(null);

  const engineReady = engine.state === 'ready';
  const guidePassed = camera.active && engineReady && guide.issue === null;
  const busy = capturing || registration.isPending;

  const handleCapture = async () => {
    const video = camera.videoRef.current;
    if (!video) return;

    setCaptureIssue(null);
    setCapturing(true);
    try {
      const result = await engine.embed(video);

      if ('error' in result) {
        setCaptureIssue(result.error);
        return;
      }

      // 캡처 시점에는 흔들림·밝기까지 함께 봅니다 (가이드 루프에서는 못 재는 값)
      const issue = checkFaceQuality(result.faces, {
        sharpness: result.sharpness,
        brightness: result.brightness,
      });
      if (issue || !result.embedding) {
        setCaptureIssue(issue?.message ?? '얼굴을 인식하지 못했어요. 다시 시도해 주세요.');
        return;
      }

      registration.mutate(result.embedding);
    } finally {
      setCapturing(false);
    }
  };

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
      {/* 아직 등록하지 않은 사람에게만 건너뛰기를 줍니다.
          가입 직후에 카메라를 강요하면 그 자리에서 이탈합니다 —
          대신 예매할 때 다시 안내받습니다. (이미 등록한 사람에겐 의미 없는 버튼) */}
      <Header
        title="얼굴 등록"
        showBack
        right={
          user?.faceRegistered ? undefined : (
            <Button
              size="sm"
              variant="ghost"
              className="mr-1"
              onClick={() => navigate(ROUTES.HOME, { replace: true })}
            >
              건너뛰기
            </Button>
          )
        }
      />

      <div className="space-y-4 p-4">
        <Card className="flex gap-3">
          <ShieldCheck size={22} className="text-ink-muted shrink-0" />
          <div className="space-y-1 text-xs">
            <p className="text-[0.8125rem] font-bold">사진은 기기 밖으로 나가지 않아요</p>
            <p className="text-muted leading-relaxed">
              촬영한 얼굴은 이 기기 안에서만 처리되고, 서버에는 알아볼 수 없는 특징값만
              저장됩니다. 등록한 특징값은 입장 시 본인 확인에만 사용돼요.
            </p>
          </div>
        </Card>

        <CameraStage
          videoRef={camera.videoRef}
          active={camera.active}
          faces={guide.faces}
          ready={guidePassed}
          placeholder={camera.error ? undefined : '카메라를 켜고 얼굴을 화면 안에 맞춰주세요'}
        />

        {/* 안내는 **한 줄만**. 여러 개를 동시에 띄우면 무엇부터 고칠지 모릅니다. */}
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
            {registration.isPending ? '등록하는 중' : capturing ? '얼굴을 확인하는 중' : '촬영하기'}
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
      </div>
    </>
  );
}
