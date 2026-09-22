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
}

/** 서버 `placements` 에 실제로 담기는 모양 — `Placed` 에서 `url` 만 뺀 것입니다 */
export type PlacedRecord = Omit<Placed, 'url'>;

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
} as const;
