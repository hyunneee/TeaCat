/**
 * AI 스티커 — 그리기 쪽 타입.
 *
 * 🔴 좌표는 전부 **0~1 로 정규화**해 둡니다. 캔버스가 폰에서는 343px, 데스크톱에서는
 * 336px 로 그려지고 서버에는 1024px 로 보내는데, 픽셀로 저장하면 창 크기를 바꾸는
 * 순간 그림이 틀어집니다. 그리는 순간에만 픽셀로 바꿉니다.
 */

/** 정규화 좌표 (0~1). 캔버스는 정사각형이라 x·y 축 척도가 같습니다. */
export interface Point {
  x: number;
  y: number;
}

/**
 * 붓 굵기 — 슬라이더 하나로 고릅니다 (볼륨처럼). 값은 **1024px 기준 선 굵기(px)** 입니다.
 * 화면에 그릴 때는 캔버스 크기에 비례해 줄어들고, 서버로 보낼 때 이 굵기가 됩니다.
 * (처음엔 3단계 버튼이었는데 "내가 정하고 싶다" 는 요청으로 연속값으로 바꿨습니다)
 */
export const BRUSH_MIN = 2;
export const BRUSH_MAX = 40;
export const BRUSH_DEFAULT = 12;

/**
 * 지우개 굵기 = 붓 굵기 × 이 비율. 슬라이더를 키우면 지우개도 함께 커집니다.
 * 붓보다 넉넉해야 그린 선을 한 번에 지울 수 있습니다.
 */
export const ERASER_RATIO = 1.8;
export const ERASER_MIN = 8;

export function eraserWidth(brush: number): number {
  return Math.max(ERASER_MIN, Math.round(brush * ERASER_RATIO));
}

export type DrawTool = 'pen' | 'eraser';

/**
 * 잉크 팔레트 기본 4색 + 사용자가 `+` 로 더한 색.
 *
 * 🔴 이것은 **화면(UI) 색이 아니라 사용자가 그리는 잉크 색**입니다. `CLAUDE.md` 4-6 의
 * 70:25:5 예외 표에 "스티커 잉크" 로 올라 있고, 값은 **여기 한 곳**에만 있습니다.
 * 화면 코드는 이 배열을 그대로 쓰고 색값을 따로 적지 않습니다.
 *
 * 색을 두는 이유: Qwen-Image-Edit 는 스케치를 컬러로 보고 **그린 색을 결과에 살립니다**
 * (2026-09-19 fal 실측: 빨간 하트+파란 눈 → 핑크 하트+파란 눈). 그래서 색이 결과를 바꾸는
 * 실제 조절 수단입니다. SDXL 경로였다면 색이 버려져서 넣지 않았을 것입니다.
 */
export const INK_PALETTE = ['#111111', '#e03131', '#2b6be0', '#f2b800'] as const;
export const INK_DEFAULT: string = INK_PALETTE[0];
/**
 * 팔레트는 **늘 4칸**입니다. `+` 로 색을 더하면 한 칸이 빠집니다 — 검정(첫 칸)은 지키고
 * 나머지 중 가장 오래된 것이 나갑니다. 폰 폭에서 도구 줄이 한 줄에 들어가야 해서 칸을 늘리지 않습니다.
 */
export const INK_PALETTE_MAX = 4;

/**
 * 획 하나. 지우개 획도 같은 모양으로 저장합니다 — 배경이 흰색이라
 * **흰 선을 그리는 것과 지우는 것이 같습니다.** 별도의 합성 모드가 필요 없고,
 * 되돌리기가 획 배열을 자르는 것만으로 성립합니다.
 */
export interface Stroke {
  tool: DrawTool;
  /** 1024px 기준 굵기 */
  width: number;
  /** 잉크 색 (hex). 지우개는 무시됩니다(항상 흰색) */
  color: string;
  points: Point[];
}

/** 서버로 보내는 낙서의 한 변 길이. 워커가 어차피 여백을 자르고 이 크기로 맞춥니다 */
export const DOODLE_EXPORT_SIZE = 1024;

/** 되돌리기 스택 상한 (설계 5-3). 마우스 낙서는 이보다 길어지지 않습니다 */
export const MAX_UNDO = 50;
