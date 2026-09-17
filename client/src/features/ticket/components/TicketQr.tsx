import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ScanFace, TriangleAlert } from 'lucide-react';
import { Spinner } from '@/shared/components/ui';
import { cn } from '@/shared/lib';

interface Props {
  /** 서버가 서명해 준 문자열. 아직 못 받았으면 null */
  payload: string | null;
  /** 얼굴 등록이 안 됐으면 QR 을 흐리게 하고 안내합니다 */
  locked?: boolean;
  lockMessage?: string;
}

/** 화면에 그릴 픽셀 크기. 고해상도 화면에서 뭉개지지 않게 2배로 그립니다 */
const QR_SIZE = 208;

/**
 * 입장 QR.
 *
 * 🔴 **담기는 값은 티켓 번호가 아니라 서버가 서명한 문자열입니다.** 번호를 그대로 담으면
 * 아무 숫자나 QR 로 만들어 게이트에 들이대는 것만으로 남의 예매 정보가 검표 화면에 뜹니다.
 * 그래서 이 컴포넌트는 값을 **만들지 않고 받기만** 합니다 — 만들 수 있으면 위조도 됩니다.
 *
 * ⚠️ 문자열 자체는 화면에 쓰지 않습니다. 곁에 적어두면 눈으로 베껴 갈 수 있고,
 * 사람이 읽을 일도 없는 값입니다.
 */
export function TicketQr({ payload, locked = false, lockMessage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !payload) return;

    setFailed(false);
    QRCode.toCanvas(canvas, payload, {
      width: QR_SIZE,
      margin: 1,
      /* 흑백 그대로 둡니다. 브랜드 색을 넣으면 대비가 떨어져 스캔이 느려집니다 */
      color: { dark: '#000000', light: '#ffffff' },
      /* 게이트 조명이 고르지 않고 화면에 지문도 묻습니다. 오류 정정을 높게 잡아
         일부가 가려져도 읽히게 합니다 (대신 점이 촘촘해집니다) */
      errorCorrectionLevel: 'M',
    }).catch(() => setFailed(true));
  }, [payload]);

  return (
    <div className="relative flex flex-col items-center gap-3">
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-xl bg-white transition-all duration-300',
          'aspect-square w-52',
          locked && 'blur-[7px] grayscale',
        )}
      >
        {payload && !failed && <canvas ref={canvasRef} className="size-full" />}

        {!payload && !failed && <Spinner />}

        {failed && (
          <p className="text-subtle flex flex-col items-center gap-1 px-4 text-center text-xs">
            <TriangleAlert size={22} />
            QR 을 그리지 못했어요
          </p>
        )}
      </div>

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
