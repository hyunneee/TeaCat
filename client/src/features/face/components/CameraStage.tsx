import type { RefObject } from 'react';
import { ScanFace } from 'lucide-react';
import { cn } from '@/shared/lib';
import { selectPrimaryFace } from '../model/faceQuality';
import type { DetectedFace } from '../model/face.types';

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  /** 지금 프레임에서 찾은 얼굴들 (0~1 정규화 좌표) */
  faces: readonly DetectedFace[];
  /** 품질 게이트 통과 여부 — 가이드 원의 색이 바뀝니다 */
  ready: boolean;
  /** 카메라가 아직 안 켜졌을 때 가운데 띄울 문구 */
  placeholder?: string;
  /** 자동 셔터 진행도 0~1. 주면 테두리가 차오릅니다 */
  progress?: number;
}

/**
 * 카메라 미리보기 + 얼굴 가이드 — 순수 View 입니다.
 * 검출도 추론도 하지 않고 **받은 좌표만 그립니다.**
 *
 * ⚠️ 미리보기는 좌우를 뒤집습니다(`scale-x-[-1]`). 거울처럼 보여야
 *    사람이 직관적으로 얼굴을 맞춥니다. **검출은 뒤집지 않은 원본**으로 하므로
 *    박스 좌표도 그릴 때만 같이 뒤집어야 합니다.
 */
export function CameraStage({ videoRef, active, faces, ready, placeholder, progress = 0 }: Props) {
  /* 찍힐 얼굴을 눈에 보이게 표시합니다. 뒤에 선 사람에게도 똑같은 네모를 그리면
     "누가 찍히는 건가" 를 알 수 없고, 배경 사람이 찍힐까 봐 자리를 비키게 됩니다.
     🔴 판정과 **같은 함수**로 고릅니다 — 다른 규칙으로 그리면 화면이 거짓말을 합니다. */
  const primary = selectPrimaryFace(faces);

  return (
    /* 켜져 있을 때는 회색 면·둥근 모서리를 뺍니다. 원 바깥이 흰 면이라 어차피 안 보이고,
       남겨 두면 모서리의 안티앨리어싱으로 회색 호가 비칩니다 */
    <div
      className={cn(
        'relative mx-auto aspect-square w-full max-w-xs overflow-hidden',
        !active && 'surface-2 rounded-3xl',
      )}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        // iOS 에서 자동재생이 막히지 않게 셋 다 필요합니다
        autoPlay
        className={cn('size-full scale-x-[-1] object-cover', !active && 'opacity-0')}
      />

      {!active && (
        <div className="text-subtle absolute inset-0 flex flex-col items-center justify-center gap-2">
          <ScanFace size={40} strokeWidth={1.2} />
          {placeholder && <p className="px-6 text-center text-xs">{placeholder}</p>}
        </div>
      )}

      {active && (
        <>
          {/* 검출된 얼굴 — 미리보기가 뒤집혀 있으므로 x 도 뒤집어 그립니다.
              찍힐 얼굴만 진하게, 뒤에 선 사람은 흐리게 그립니다.
              원 바깥으로 나간 부분은 아래 흰 면이 덮도록 원보다 먼저 그립니다. */}
          {faces.map((face, index) => (
            <span
              key={index}
              aria-hidden
              className={cn(
                'pointer-events-none absolute rounded-xl transition-colors',
                face === primary
                  ? cn('border-2', ready ? 'border-accent-700' : 'border-white/70')
                  : 'border border-dashed border-white/25',
              )}
              style={{
                left: `${(1 - face.box.x - face.box.width) * 100}%`,
                top: `${face.box.y * 100}%`,
                width: `${face.box.width * 100}%`,
                height: `${face.box.height * 100}%`,
              }}
            />
          ))}

          {/* 얼굴을 맞출 원. 통과하면 선이 진해집니다.
              원 바깥은 흰 면으로 채웁니다 — 퍼지는 그림자를 컨테이너의 overflow-hidden 이 자릅니다.
              흰 면 위라 기본 선도 흰색이면 안 보여서 회색으로 둡니다. */}
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-8 rounded-full border-2 border-dashed shadow-[0_0_0_100vmax_var(--color-surface-1)] transition-colors duration-200',
              ready ? 'border-accent-700' : 'border-line-strong',
            )}
          />

          {/* 자동 셔터가 차오르는 것을 보여줍니다. 안 보이면 언제 찍히는지 알 수 없어
              사람이 계속 움직이고, 그러면 카운트가 계속 처음으로 돌아갑니다. */}
          {progress > 0 && (
            <span
              aria-hidden
              className="bg-accent-700 pointer-events-none absolute inset-x-0 bottom-0 h-1 origin-left transition-transform duration-100"
              style={{ transform: `scaleX(${progress})` }}
            />
          )}
        </>
      )}
    </div>
  );
}
