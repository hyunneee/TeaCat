import { BANNER_FOCUS_GRID, objectPositionOf, type BannerImageFocus } from '@/features/banner';
import { cn } from '@/shared/lib';

/**
 * 배너 그림에서 **보여줄 부분** 고르기.
 *
 * 배너 틀은 폰 4:3, 데스크톱 2:1 입니다. 올린 그림이 그 비율이 아니면 반드시 잘리는데,
 * 기본값(가운데)이 늘 맞지는 않습니다 — 얼굴이 위에 있는 포스터는 가운데만 남기면
 * 목부터 보입니다. 그래서 등록하는 사람이 고릅니다.
 *
 * 🔴 **고르는 칸을 목록이 아니라 그림 위 3 × 3 격자로 둔 이유**가 있습니다.
 *    "위·가운데·아래" 를 글자로 고르면 고른 결과를 머릿속에서 그려야 합니다.
 *    격자는 누르는 자리가 곧 남을 자리라, 미리보기와 눈이 한 번에 맞습니다.
 *
 * 미리보기를 **둘** 두는 것도 같은 이유입니다. 값 하나가 두 틀에 함께 걸리므로
 * 한쪽만 보고 고르면 다른 쪽에서 잘린 것을 등록 뒤에야 알게 됩니다.
 */
export interface BannerFocusPickerProps {
  /** 미리 볼 그림. 이미지 배너면 올린 그림, 공연 배너면 그 공연 포스터입니다 */
  imageUrl: string;
  value: BannerImageFocus;
  onChange: (focus: BannerImageFocus) => void;
}

/** 스크린리더용 이름. 격자는 눈으로 고르는 것이라 화면에는 글자를 쓰지 않습니다 */
const FOCUS_LABEL: Record<BannerImageFocus, string> = {
  TOP_LEFT: '왼쪽 위',
  TOP: '위쪽 가운데',
  TOP_RIGHT: '오른쪽 위',
  LEFT: '왼쪽 가운데',
  CENTER: '가운데',
  RIGHT: '오른쪽 가운데',
  BOTTOM_LEFT: '왼쪽 아래',
  BOTTOM: '아래쪽 가운데',
  BOTTOM_RIGHT: '오른쪽 아래',
};

export function BannerFocusPicker({ imageUrl, value, onChange }: BannerFocusPickerProps) {
  const objectPosition = objectPositionOf(value);

  return (
    <div className="space-y-2">
      <p className="text-ink text-sm font-medium">보여줄 부분</p>
      <p className="text-ink-muted text-xs">
        그림이 배너 비율과 다르면 나머지가 잘립니다. 남길 곳을 눌러 고르세요.
      </p>

      <div className="flex items-start gap-3">
        {/* 데스크톱(2:1) — 가장 많이 잘리는 틀이라 고르는 격자를 여기에 얹습니다 */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="border-line relative aspect-[2/1] overflow-hidden rounded-xl border">
            <img
              src={imageUrl}
              alt="데스크톱 배너 미리보기"
              style={{ objectPosition }}
              className="size-full object-cover"
            />

            {/* 격자 — 아홉 칸이 그대로 아홉 가지 자리입니다 */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
              {BANNER_FOCUS_GRID.map((focus) => (
                <button
                  key={focus}
                  type="button"
                  aria-label={`${FOCUS_LABEL[focus]} 기준으로 보여주기`}
                  aria-pressed={focus === value}
                  onClick={() => onChange(focus)}
                  className={cn(
                    /* 안 고른 칸은 **테두리만** 보입니다. 아홉 칸을 모두 덮으면
                       고르기도 전에 그림이 안 보여 무엇을 남길지 판단할 수 없습니다. */
                    'border border-white/25 transition-colors hover:bg-white/20',
                    focus === value && 'bg-white/15 ring-2 ring-white ring-inset',
                  )}
                />
              ))}
            </div>
          </div>
          <p className="text-ink-subtle text-center text-[0.6875rem]">데스크톱 (2:1)</p>
        </div>

        {/* 폰(4:3) — 같은 값이 여기에도 걸립니다. 누르는 곳은 아니라 읽기 전용입니다 */}
        <div className="w-24 shrink-0 space-y-1">
          <div className="border-line aspect-[4/3] overflow-hidden rounded-lg border">
            <img
              src={imageUrl}
              alt="폰 배너 미리보기"
              style={{ objectPosition }}
              className="size-full object-cover"
            />
          </div>
          <p className="text-ink-subtle text-center text-[0.6875rem]">폰 (4:3)</p>
        </div>
      </div>
    </div>
  );
}
