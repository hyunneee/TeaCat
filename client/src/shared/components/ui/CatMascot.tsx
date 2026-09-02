import { cn } from '@/shared/lib';

/**
 * 티캣 마스코트 — "티켓 한 장이 고양이가 된" 형태.
 *
 * 위쪽 두 귀퉁이가 귀, 아래쪽에 티켓 절취선이 있습니다.
 * `public/icons/logo.svg` 와 같은 형태라 앱과 앱 아이콘이 이어져 보입니다.
 *
 * 무채색이므로 **배경에 따라 흑백을 뒤집어야** 합니다.
 *   흰 배경  → 기본 (검은 고양이)
 *   검정 배경 → `invert` (흰 고양이)
 */

export type CatMood =
  /** 기본 */
  | 'neutral'
  /** 완료·성공 (눈이 웃음) */
  | 'happy'
  /** 빈 목록·오류 (눈이 처짐) */
  | 'sad'
  /** 준비 중 (눈 감음) */
  | 'sleep';

export interface CatMascotProps {
  mood?: CatMood;
  /** px */
  size?: number;
  /** 검정 배경 위에 놓을 때 (흰 고양이) */
  invert?: boolean;
  className?: string;
  /** 장식용이면 비워두세요. 의미가 있으면 설명을 넣습니다. */
  label?: string;
}

/** 표정만 갈아 끼웁니다. 새 표정이 필요하면 여기에 한 줄 추가하세요. */
function Face({ mood, line }: { mood: CatMood; line: string }) {
  if (mood === 'sleep') {
    return (
      <g className={line} strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M22.6 33.4q3.6 2.6 7.2 0M34.2 33.4q3.6 2.6 7.2 0" />
      </g>
    );
  }

  if (mood === 'happy') {
    return (
      <g className={line} strokeWidth="2.1" strokeLinecap="round" fill="none">
        <path d="M22.6 34.4q3.6-3.4 7.2 0M34.2 34.4q3.6-3.4 7.2 0" />
      </g>
    );
  }

  if (mood === 'sad') {
    return (
      <>
        <ellipse cx="26.2" cy="34.4" rx="2.4" ry="2.6" className={line.replace('stroke', 'fill')} />
        <ellipse cx="37.8" cy="34.4" rx="2.4" ry="2.6" className={line.replace('stroke', 'fill')} />
        <g className={line} strokeWidth="1.7" strokeLinecap="round" fill="none">
          <path d="M22.4 29.6 29 31.6M41.6 29.6 35 31.6" />
        </g>
      </>
    );
  }

  return (
    <>
      <ellipse cx="26.2" cy="33.2" rx="2.5" ry="3.1" className={line.replace('stroke', 'fill')} />
      <ellipse cx="37.8" cy="33.2" rx="2.5" ry="3.1" className={line.replace('stroke', 'fill')} />
    </>
  );
}

export function CatMascot({
  mood = 'neutral',
  size = 72,
  invert = false,
  className,
  label,
}: CatMascotProps) {
  // 몸통과 선(눈·코·수염)의 밝기를 서로 뒤집습니다.
  const body = invert ? 'fill-brand-50' : 'fill-brand-900';
  const ear = invert ? 'fill-brand-300' : 'fill-brand-600';
  const line = invert ? 'stroke-brand-900' : 'stroke-brand-50';

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('shrink-0', className)}
    >
      {/* 티켓 본체 + 귀 */}
      <path
        className={body}
        d="M14 27.5 20.5 15l7.2 5.2h8.6L43.5 15 50 27.5v13a4.5 4.5 0 0 1-4.5 4.5h-1.9a5.6 5.6 0 0 0 0 5.6h1.9A4.5 4.5 0 0 1 50 55.1v.4H14v-.4a4.5 4.5 0 0 1 4.5-4.5h1.9a5.6 5.6 0 0 0 0-5.6h-1.9A4.5 4.5 0 0 1 14 40.5z"
      />
      {/* 귀 안쪽 */}
      <path className={ear} d="M21.4 19.6 25 22.2h-4.9zM42.6 19.6 39 22.2h4.9z" />

      {/* 절취선 */}
      <path
        className={line}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="2.4 3.4"
        fill="none"
        d="M22.8 48h18.4"
      />

      <Face mood={mood} line={line} />

      {/* 코 */}
      <path
        className={line.replace('stroke', 'fill')}
        d="M32 38.4a2.6 2.6 0 0 1-2.3-1.5.5.5 0 0 1 .5-.7h3.6a.5.5 0 0 1 .5.7A2.6 2.6 0 0 1 32 38.4"
      />

      {/* 수염 */}
      <g className={line} strokeWidth="1.3" strokeLinecap="round" opacity=".5" fill="none">
        <path d="M18.4 32.4h4.2M18.9 36.6l3.8-1M45.6 32.4h-4.2M45.1 36.6l-3.8-1" />
      </g>
    </svg>
  );
}

/**
 * 마크 + 워드마크. 로그인/가입 화면 상단처럼 브랜드를 보여줄 곳에 씁니다.
 * 헤더처럼 좁은 곳에는 `<CatMascot size={24} />` 만 쓰세요.
 */
export function Logo({
  size = 40,
  markSize,
  invert = false,
  className,
}: {
  /** 워드마크("티캣") 기준 크기 — 글자는 이 값의 0.7배입니다 */
  size?: number;
  /**
   * 마스코트만 따로 키울 때. 기본은 `size` 와 같습니다.
   * 헤더처럼 글자는 그대로 두고 그림만 키워야 하는 자리에 씁니다.
   */
  markSize?: number;
  invert?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <CatMascot size={markSize ?? size} invert={invert} label="티캣" />
      <span
        className="font-extrabold tracking-tight"
        style={{ fontSize: size * 0.7, lineHeight: 1 }}
      >
        티캣
      </span>
    </span>
  );
}
