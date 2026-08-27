import { useState } from 'react';
import { Camera, ImageUp, ScanFace, ShieldCheck } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button, Card, Segmented } from '@/shared/components/ui';
import { toast } from '@/shared/stores';
import { useFaceCamera, useFaceRegistration } from '@/features/face';
import type { FaceCaptureMode } from '@/features/face';

const MODES = [
  { value: 'CAMERA', label: '촬영하기' },
  { value: 'UPLOAD', label: '사진 등록' },
] as const;

/**
 * 얼굴 등록.
 * 티켓이 유효하려면(입장하려면) 얼굴 등록이 선행돼야 합니다. 한 번만 하면 됩니다.
 */
export function FaceRegisterPage() {
  const [mode, setMode] = useState<FaceCaptureMode>('CAMERA');
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  const camera = useFaceCamera();
  const registration = useFaceRegistration();

  const applyImage = (next: Blob) => {
    setBlob(next);
    setPreview(URL.createObjectURL(next));
    camera.stop();
  };

  const handleCapture = async () => {
    const captured = await camera.capture();
    if (!captured) {
      toast.error('촬영에 실패했어요. 다시 시도해 주세요.');
      return;
    }
    applyImage(captured);
  };

  return (
    <>
      <Header title="얼굴 등록" showBack />

      <div className="space-y-4 p-4">
        <Card className="flex gap-3">
          <ShieldCheck size={22} className="text-brand-500 shrink-0" />
          <div className="space-y-1 text-xs">
            <p className="text-[0.8125rem] font-bold">한 번만 등록하면 됩니다</p>
            <p className="text-muted leading-relaxed">
              등록한 얼굴은 입장 시 본인 확인에만 사용됩니다. 얼굴이 등록되지 않으면 티켓을 사용할
              수 없습니다.
            </p>
          </div>
        </Card>

        <Segmented options={MODES} value={mode} onChange={setMode} />

        {/* 미리보기 / 카메라 영역 */}
        <div className="surface-sunken relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-3xl border">
          {preview ? (
            <img src={preview} alt="등록할 얼굴 미리보기" className="size-full object-cover" />
          ) : mode === 'CAMERA' ? (
            <>
              <video
                ref={camera.videoRef}
                playsInline
                muted
                className="size-full scale-x-[-1] object-cover"
              />
              {!camera.active && (
                <div className="text-subtle absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <ScanFace size={40} strokeWidth={1.2} />
                  <p className="px-6 text-center text-xs">
                    {camera.error ?? '카메라를 켜고 얼굴을 화면 안에 맞춰주세요'}
                  </p>
                </div>
              )}
              {/* 가이드 원 */}
              {camera.active && (
                <span className="border-brand-400/70 pointer-events-none absolute inset-8 rounded-full border-2 border-dashed" />
              )}
            </>
          ) : (
            <label className="text-subtle flex size-full cursor-pointer flex-col items-center justify-center gap-2">
              <ImageUp size={38} strokeWidth={1.2} />
              <span className="text-xs">사진을 선택하세요</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) applyImage(file);
                }}
              />
            </label>
          )}
        </div>

        {/* 액션 */}
        <div className="flex flex-col gap-2">
          {preview ? (
            <>
              <Button
                size="lg"
                fullWidth
                loading={registration.isPending}
                onClick={() => blob && registration.mutate(blob)}
              >
                이 사진으로 등록하기
              </Button>
              <Button
                variant="ghost"
                fullWidth
                onClick={() => {
                  setPreview(null);
                  setBlob(null);
                }}
              >
                다시 선택
              </Button>
            </>
          ) : mode === 'CAMERA' ? (
            camera.active ? (
              <Button size="lg" fullWidth leftIcon={<Camera size={18} />} onClick={handleCapture}>
                촬영하기
              </Button>
            ) : (
              <Button size="lg" fullWidth onClick={() => void camera.start()}>
                카메라 켜기
              </Button>
            )
          ) : null}
        </div>

        {camera.error && <p className="text-danger text-center text-xs">{camera.error}</p>}
      </div>
    </>
  );
}
