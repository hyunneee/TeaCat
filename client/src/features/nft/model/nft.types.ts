/**
 * 서버 `NftController` 응답과 1:1 입니다. **필드 이름을 바꾸지 마세요.**
 * 서버 DTO 이름 → 여기 타입 이름:
 *   NftMarketPhotocardResponse → MarketPhotocard
 *   MyNftPhotocardResponse     → MyPhotocard
 *   NftPhotocardDetailResponse → PhotocardDetail
 *   NftListingResponse         → PhotocardListing
 *   NftPurchaseResponse        → PurchaseResult
 *   NftPurchaseHistoryResponse → PurchaseHistory
 *   NftSaleHistoryResponse     → SaleHistory
 *   NftPhotocardTradeHistoryResponse → PhotocardTradeHistory
 *
 * 시각은 서버가 타임존 없는 KST 문자열("2026-09-09T21:00:00")로 줍니다.
 * 금액(CAT)은 정수입니다.
 */

export type PhotocardMintStatus = 'PENDING' | 'MINTING' | 'MINTED' | 'FAILED';
export type ListingStatus = 'ACTIVE' | 'SOLD' | 'CANCELLED';

/** 마켓 목록 항목 — 판매 중인 카드만 온다 */
export interface MarketPhotocard {
  photocardId: number;
  listingId: number;
  designName: string;
  imageUrl: string | null;
  performanceTitle: string;
  /** 판매가(CAT) */
  price: number;
  sellerNickname: string;
}

/** 내 포카 목록 항목 */
/**
 * 🔴 `group`·`grade` 는 **선택**입니다. 실서버 응답(NftPhotocardDetailResponse)에는 아직
 * 없고 목업만 채웁니다. 없으면 화면은 이름만 · 금색으로 물러섭니다(추측하지 않습니다).
 * 서버가 주기 시작하면 물음표만 떼면 됩니다. (CLAUDE.md 8장)
 */
export interface PocaDesignInfo {
  /**
   * 같은 도안이 지금까지 거래된 평균가(CAT). 거래가 없으면 null.
   * 🔴 실서버 응답에는 아직 없습니다 — 목업이 지난 거래에서 계산해 줍니다.
   */
  averagePrice?: number | null;
  /** 소속 — '서울 5반' · '15기' · '개발자' */
  group?: string;
  grade?: PocaGrade;
}

export interface MyPhotocard extends PocaDesignInfo {
  photocardId: number;
  designName: string;
  imageUrl: string | null;
  performanceTitle: string;
  status: PhotocardMintStatus;
  /** 판매 등록 여부. 가격은 오지 않는다 (서버 미결) */
  listed: boolean;
}

/** 포카가 발행된 좌석 */
export interface PhotocardOrigin {
  seatGrade: string;
  areaCode: string;
  /** 스탠딩이면 null */
  rowLabel: string | null;
  /** 스탠딩이면 null */
  seatNumber: number | null;
}

/** 포카 상세 */
export interface PhotocardDetail extends PocaDesignInfo {
  photocardId: number;
  designName: string;
  imageUrl: string | null;
  performanceTitle: string;
  ownerNickname: string;
  issuedAt: string;
  origin: PhotocardOrigin;
  status: PhotocardMintStatus;
  /** 판매 중이 아니면 null. 서버 봉투가 null 을 생략할 수도 있어 undefined 도 허용 */
  listing?: {
    listingId: number;
    price: number;
    sellerDescription: string;
    listedAt: string;
  } | null;
  /** 경매 중이 아니면 null. 화면은 경매 브랜치에서 그린다 */
  auction?: {
    auctionId: number;
    currentPrice: number;
    buyNowPrice: number | null;
    bidCount: number;
    endsAt: string;
  } | null;
}

/** 판매 등록(P3) 응답 */
export interface PhotocardListing {
  listingId: number;
  price: number;
  description: string;
  status: ListingStatus;
}

/** 구매(P5) 응답 */
export interface PurchaseResult {
  tradeId: number;
  photocardId: number;
  price: number;
  tradedAt: string;
}

/** 내 구매 내역 항목 */
export interface PurchaseHistory {
  tradeId: number;
  photocardId: number;
  designName: string;
  imageUrl: string | null;
  sellerNickname: string;
  price: number;
  tradedAt: string;
}

/** 내 판매 내역 항목 */
export interface SaleHistory {
  tradeId: number;
  photocardId: number;
  designName: string;
  imageUrl: string | null;
  buyerNickname: string;
  price: number;
  tradedAt: string;
}

/** 포카 한 장의 거래 이력 항목 (P9) — api 만 두고 화면은 아직 없다 */
export interface PhotocardTradeHistory {
  tradeId: number;
  price: number;
  sellerNickname: string;
  buyerNickname: string;
  tradedAt: string;
}

/**
 * 화면용 — 구매·판매를 한 목록으로 섞을 때.
 * 서버 응답이 아니라 `mergeTrades()` 가 만든다.
 */
export interface PhotocardTrade {
  tradeId: number;
  photocardId: number;
  designName: string;
  imageUrl: string | null;
  /** 내가 산 건지 판 건지 */
  type: 'BUY' | 'SELL';
  price: number;
  tradedAt: string;
  /** 거래 상대 닉네임 */
  counterpartyNickname: string;
}

/* ── 뽑기 ──────────────────────────────────────────────────── */

/**
 * 연출 등급. **서버가 정합니다** — 프론트가 designName 을 보고 추측하지 않습니다.
 * 도안이 늘어날 때마다 화면 코드를 고쳐야 하는 구조가 되면 안 됩니다.
 */
export type PocaGrade = 'SPECIAL' | 'COMMON';

/** `POST /photocards/draw` 응답 */
export interface PocaDrawResult {
  photocardId: number;
  designName: string;
  imageUrl: string | null;
  /** 소속 표시용 — '서울 4반' / '15기' / '개발자' */
  group: string;
  grade: PocaGrade;
  issuedAt: string;
}
