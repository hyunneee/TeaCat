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

/* ───────────────────────── 서버 계약 (구현 계획 0-1 · 설계 6-1) ─────────────────────────
   🔴 2026-09-21 부터 **실서버가 기준**입니다. 목업(mocks/handlers/sticker.ts)은 지웠습니다.
   백엔드 완성 + GPU 워커 연결까지 확인했고, 이 타입은 서버 응답을 그대로 받아쓰는 모양입니다. */

/** 생성 작업 상태. 워커가 집어가면 RUNNING, 결과가 올라오면 DONE */
export type StickerJobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

/** 만들어진 스티커 한 장. DONE 이 되는 순간 서버가 만들어 두므로 따로 "저장" 요청이 없습니다 */
export interface Sticker {
  id: number;
  /** 투명 PNG (presigned URL, 배너와 같은 패턴) */
  imageUrl: string;
  createdAt: string;
  /**
   * 꾸미기에 이미 썼는가 (2026-09-23).
   *
   * 🔴 **되돌릴 수 없습니다.** 한 번 붙이면 뗄 수 없고, 카드가 팔리면 카드를 따라갑니다.
   *    목록에서는 회색 "사용됨" 으로 보이고, 꾸미기 서랍에는 아예 나오지 않습니다.
   */
  used: boolean;
  /** 붙어 있는 카드 id. 안 썼으면 null */
  usedPhotocardId: number | null;
}

export interface StickerJob {
  jobId: number;
  status: StickerJobStatus;
  /** DONE 일 때만 */
  sticker?: Sticker;
  /** FAILED 일 때만. 화면에 그대로 보여줄 문장이 아니라 코드 */
  failReason?: string;
}

/**
 * 생성 요청. 🔴 파일이 아니라 **캔버스가 만든 PNG 의 base64** 입니다 (구현 계획 3-0).
 * `subject` 는 재시도 때만, 20자 — 서버도 같은 길이로 막습니다 (설계 9-2).
 */
export interface CreateStickerRequest {
  sketchBase64: string;
  subject?: string;
  /** "다시 만들기" 는 seed 를 바꿔 같은 낙서로 다른 결과를 냅니다 */
  seed?: number;
  /**
   * 낙서에서 가장 많이 쓴 잉크 색 (`#RRGGBB`). 서버가 이걸로 결과 색을 정합니다.
   *
   * 🔴 이게 없으면 결과 색이 바랩니다 — 얇은 선화는 모델이 색을 확신하지 못해
   * 회색빛으로 칠합니다 (2026-09-21 GPU 실측: 같은 낙서가 색 지정 없이는 연한 세이지,
   * 지정하면 선명하게 나왔습니다). 기본 검정만 썼으면 **생략**하고, 그때는 서버가
   * 주제에 맞는 색을 고르게 둡니다.
   */
  inkColor?: string;
}

export interface CreateStickerResponse {
  jobId: number;
  /** 오늘 더 만들 수 있는 장수 (일일 상한 5, 설계 9-1) */
  remainingToday: number;
}

/** 오늘 몫. 화면이 "오늘 N장 남음" 을 보여줄 때 씁니다 */
export interface StickerQuota {
  limit: number;
  used: number;
  remaining: number;
  /**
   * 남은 몫을 다 쓴 뒤 1장당 드는 캣머니 (2026-09-23).
   *
   * 🔴 **화면에 숫자를 박지 마세요.** 서버 설정(STICKER_EXTRA_PRICE_CAT)으로 바뀌는 값이라,
   *    박아 두면 버튼에 적힌 금액과 실제로 빠지는 금액이 달라집니다.
   */
  extraPriceCat: number;
}

/** 서버가 일일 상한에서 내는 에러 코드 (429) */
export const STICKER_ERROR = {
  /* 🔴 이제 거의 안 납니다 — 하루 몫을 넘겨도 캣머니로 더 만들 수 있습니다 (2026-09-23) */
  DAILY_LIMIT: 'STICKER_001',
  /** 무료 몫을 다 썼는데 캣머니도 모자람 */
  NOT_ENOUGH_CAT: 'STICKER_010',

  /*
   * 🔴 유료 생성은 **지갑을 탑니다.** 지갑이 없거나 아직 만들어지는 중이면 스티커 코드가
   *    아니라 지갑 코드가 옵니다 (실제로 로컬에서 WALLET_010 을 받고 확인했습니다).
   *    가르지 않으면 "만들기를 시작하지 못했어요" 만 떠서 사용자가 할 일을 모릅니다.
   */
  WALLET_PROVISIONING: 'WALLET_010',
  WALLET_NOT_FOUND: 'WALLET_003',
} as const;

/** 주제 입력 상한 (설계 9-2) */
export const SUBJECT_MAX = 20;

/** 되돌리기 스택 상한 (설계 5-3). 마우스 낙서는 이보다 길어지지 않습니다 */
export const MAX_UNDO = 50;
