import type { RefObject } from 'react';
import { ScanLine } from 'lucide-react';
import { cn } from '@/shared/lib';

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  scanning: boolean;
  /** 카메라를 못 켰을 때 대신 띄울 안내 */
  placeholder?: string;
}

/**
 * QR 카메라 미리보기 — 순수 View 입니다. 디코드는 `useQrScanner` 가 합니다.
 *
 * ⚠️ 얼굴 카메라(`CameraStage`)와 달리 **좌우를 뒤집지 않습니다.** 자기 얼굴을 맞추는
 * 화면이 아니라 상대의 폰을 찍는 화면이라, 거울처럼 뒤집으면 오히려 맞추기 어렵습니다.
 */
export function QrScanStage({ videoRef, scanning, placeholder }: Props) {
  return (
    <div className="surface-2 relative mx-auto aspect-video w-full overflow-hidden rounded-2xl">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={cn('size-full object-cover', !scanning && 'opacity-0')}
      />

      {!scanning && (
        <div className="text-subtle absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <ScanLine size={40} strokeWidth={1.2} />
          {placeholder && <p className="text-xs leading-relaxed">{placeholder}</p>}
        </div>
      )}

      {scanning && (
        /* 가운데 네모 — 어디에 대야 하는지 알려줍니다. 인식은 화면 전체에서 합니다 */
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-1/4 inset-y-[12%] rounded-xl border-2 border-dashed border-white/70"
        />
      )}
    </div>
  );
}
