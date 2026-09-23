/**
 * 포카 꾸미기 — 카드 위에 AI 스티커를 얹은 결과.
 *
 * 서버 계약은 `NftDecorationController` / `NftDecorationSaveRequest` 와 1:1 입니다.
 * 합성(카드+스티커 → PNG)은 **브라우저가** 하고 서버는 올려 두기만 합니다.
 */

/**
 * 카드 위에 얹은 스티커 한 장.
 *
 * 🔴 좌표는 **픽셀이 아니라 비율**입니다. 화면 폭은 기기마다 다른데 내보내는 캔버스는
 *    카드 원본 해상도라, 픽셀로 잡으면 화면과 결과물이 어긋납니다.
 */
export interface Placed {
  /** 화면용 고유 id — 같은 스티커를 두 번 올릴 수 있습니다 */
  id: string;
  stickerId: number;
  /**
   * 지금 화면에 쓰는 스티커 그림 주소.
   *
   * 🔴 **저장하지 않습니다** (`PlacedRecord` 에 없습니다). presigned 라 만료돼서,
   *    배치와 함께 넣어 두면 다음에 열었을 때 죽은 주소가 복원됩니다.
   *    다시 꾸밀 때는 `stickerId` 로 내 스티커 목록에서 **새 주소**를 찾습니다.
   */
  url: string;
  /** 카드 기준 중심 좌표 0~1 */
  x: number;
  y: number;
  /** 카드 폭 대비 배율 */
  scale: number;
  /** 도(degree) */
  rotation: number;
  /**
   * 이미 저장돼 **잠긴** 스티커인가 (2026-09-23).
   *
   * 🔴 **스티커는 한 번 붙이면 뗄 수 없습니다.** "완료하기" 를 누르는 순간 소모가 확정되고
   *    그 배치는 잠깁니다. 잠긴 것에는 지우기 손잡이를 달지 않고, 옮기지도 못하게 합니다.
   *
   * 🔴 **저장하지 않습니다** (`PlacedRecord` 에 없습니다). 무엇이 잠겼는지는 서버가 압니다 —
   *    다시 열 때 서버에서 받은 배치는 전부 잠긴 것이고, 이번에 새로 얹은 것만 자유입니다.
   *
   * ⚠️ 이 값이 새면 사용자가 뗄 수 있다고 착각하고, 저장할 때 `NFT_071` 로 거절당합니다.
   */
  locked?: boolean;
}

/**
 * 서버 `placements` 에 실제로 담기는 모양 — `Placed` 에서 화면 전용 필드를 뺀 것입니다.
 *
 * 🔴 `url`(만료됨)과 `locked`(서버가 앎)는 담지 않습니다.
 */
export type PlacedRecord = Omit<Placed, 'url' | 'locked'>;

/** 서버 `NftDecorationResponse` 와 1:1 입니다 */
export interface Decoration {
  /** 🔴 presigned 라 만료됩니다. 들고 있지 말고 필요할 때 다시 받습니다 */
  imageUrl: string;
  /** JSON 배열 문자열. 파싱하면 `PlacedRecord[]` 입니다 */
  placements: string;
}

/** 스티커 기본 크기 — 카드 폭의 30% */
export const PLACED_DEFAULT_SCALE = 0.3;
export const PLACED_MIN_SCALE = 0.1;
export const PLACED_MAX_SCALE = 1.0;
/** 넘으면 저장이 눈에 띄게 느려지고, 그만큼 붙일 이유도 없습니다 */
export const PLACED_MAX_COUNT = 20;

/** 서버가 내는 꾸밈 관련 에러 코드 (`NftErrorCode`) */
export const DECORATION_ERROR = {
  /** 꾸민 적 없음(404). 🔴 **정상 상태입니다** — 에러로 다루지 마세요 */
  NOT_FOUND: 'NFT_065',
  IMAGE_INVALID: 'NFT_066',
  IMAGE_TOO_LARGE: 'NFT_067',

  /* 스티커 소모 (2026-09-23). 🔴 **한 번 붙이면 뗄 수 없습니다.** */
  PLACEMENTS_INVALID: 'NFT_068',
  /** 남의 스티커이거나 없는 스티커 */
  STICKER_NOT_USABLE: 'NFT_069',
  /** 다른 카드에 이미 쓴 스티커 */
  STICKER_ALREADY_USED: 'NFT_070',
  /**
   * 이미 붙어 있던 스티커를 빼고 저장하려 했다.
   *
   * 🔴 **화면이 먼저 막아야 하는 것**입니다. 잠긴 스티커에는 지우기 손잡이를 안 답니다.
   *    여기까지 왔다면 잠금 처리가 샌 것이니, 안내만 하고 넘기지 말고 원인을 찾아야 합니다.
   */
  STICKER_NOT_REMOVABLE: 'NFT_071',
} as const;
