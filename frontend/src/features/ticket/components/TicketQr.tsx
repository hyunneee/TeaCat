import { QrCode, ScanFace } from 'lucide-react';
import { cn } from '@/shared/lib';

interface Props {
  payload: string;
  /** 얼굴 등록이 안 됐으면 QR 을 흐리게 하고 안내합니다 */
  locked?: boolean;
  lockMessage?: string;
}

/**
 * 입장 QR.
 *
 * ⚠️ 아직 진짜 QR 이 아닙니다. 규격이 정해지지 않았습니다(플로우차트 주석: "QR은 추후 논의").
 * 라이브러리 도입은 규칙상 리드 승인이 필요하므로 지금은 자리와 잠금 UX 만 잡아둡니다.
 * 규격이 정해지면 이 컴포넌트 안만 교체하면 됩니다.
 */
export function TicketQr({ payload, locked = false, lockMessage }: Props) {
  return (
    <div className="relative flex flex-col items-center gap-3">
      <div
        className={cn(
          'relative flex aspect-square w-52 items-center justify-center overflow-hidden rounded-xl bg-white transition-all duration-300',
          locked && 'blur-[7px] grayscale',
        )}
      >
        <QrCode size={128} strokeWidth={1} className="text-black" />
      </div>

      <p className="text-subtle font-mono text-[0.6875rem] tracking-wider">{payload}</p>

      {locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
          <span className="bg-warning-soft text-warning flex size-12 items-center justify-center rounded-xl">
            <ScanFace size={26} />
          </span>
          <p className="text-sm font-bold">{lockMessage ?? '얼굴 등록이 필요해요'}</p>
        </div>
      )}
    </div>
  );
}
