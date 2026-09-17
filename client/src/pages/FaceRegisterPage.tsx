import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button, Card } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';
import { cn } from '@/shared/lib';
import { useAuth } from '@/features/auth';
import {
  CameraStage,
  FACE_GUIDE_IDLE,
  REGISTER_STEPS,
  centroidOf,
  useAutoShutter,
  useCamera,
  useFaceEngine,
  useFaceGuide,
  useFaceRegistration,
  useGuidedCapture,
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

  const engineReady = engine.state === 'ready';
  const guidePassed = camera.active && engineReady && guide.issue === null;

  /**
   * 🔴 **여러 장을 찍어 평균을 보냅니다.**
   *
   * 한 장만 등록하면 하필 그 한 장이 그 사람 얼굴 분포의 가장자리에 있었을 때,
   * 입장할 때마다 본인이 거절당합니다. 조건이 다른 다섯 장의 평균은 덩어리의
   * 한가운데라 어느 한 장보다 그 사람을 잘 대표합니다. (`centroidOf` 주석)
   *
   * ⚠️ 서버로 나가는 것은 **여전히 임베딩 하나**입니다 — 스키마도 API 도 그대로입니다.
   */
  const capture = useGuidedCapture({
    engine,
    steps: REGISTER_STEPS,
    onComplete: (embeddings) => registration.mutate(centroidOf(embeddings)),
  });

  const busy = capture.capturing || registration.isPending;
  const step = capture.checkStep(guide.faces);

  /* 🔴 촬영 버튼이 없습니다. 누르는 순간 손가락이 움직여 그 흔들림이 프레임에 남고,
     버튼을 찾느라 시선도 정면에서 벗어납니다. 자세가 잡히면 스스로 찍힙니다.
     `preparing` 동안은 겨누지 않습니다 — 다음 자세를 잡을 틈입니다. */
  const shutter = useAutoShutter({
    armed: Boolean(capture.session) && !capture.session?.preparing && !busy,
    ready: guidePassed && step.ok,
    onFire: () => {
      const video = camera.videoRef.current;
      if (video) void capture.capture(video);
    },
  });

  /* 안내는 한 줄만. 급한 것부터 — 사고(에러) → 준비 안 됨 → 얼굴 품질 → 자세 지시 순입니다.
     "얼굴이 작고 기울었고 어둡습니다" 처럼 한꺼번에 말하면 무엇부터 고칠지 알 수 없습니다. */
  const message =
    capture.issue ??
    camera.error?.message ??
    (engine.state === 'failed' ? engine.error : null) ??
    (!camera.active ? null : !engineReady ? '얼굴 인식을 준비하고 있어요…' : null) ??
    (capture.session?.preparing ? '자세를 바꿔주세요' : null) ??
    guide.issue?.message ??
    (capture.session ? (step.ok ? '좋아요, 그대로' : (step.hint ?? '지시대로 맞춰주세요')) : null) ??
    FACE_GUIDE_IDLE;

  const problem = Boolean(capture.issue || camera.error || engine.state === 'failed');

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
          progress={busy ? 0 : shutter.progress}
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
          capture.session ? (
            /* 촬영 버튼이 없습니다 — 조건이 맞으면 스스로 찍습니다. 여기는 지금 몇 장째인지와
               무엇을 해야 하는지만 알려줍니다. 진행은 미리보기 아래 선이 차오르는 것으로 보입니다. */
            <div className="space-y-1 py-2 text-center">
              <p className="text-ink text-base font-bold">{capture.session.prompt}</p>
              <p className="text-subtle text-xs tabular-nums">
                {capture.session.taken} / {capture.session.total}장
                {registration.isPending && ' · 등록하는 중…'}
              </p>
            </div>
          ) : (
            <Button
              variant="dark"
              size="lg"
              fullWidth
              loading={busy}
              disabled={!engineReady}
              onClick={capture.start}
            >
              {REGISTER_STEPS.length}장 촬영 시작
            </Button>
          )
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
