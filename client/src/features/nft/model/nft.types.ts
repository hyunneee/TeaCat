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
export type ListingStatus = 'ACTIVE' | 'SETTLING' | 'SOLD' | 'CANCELLED';
export type PhotocardMarketType = 'FIXED_PRICE' | 'AUCTION';
export type PhotocardMarketStatus = 'ACTIVE' | 'SETTLING';

/** 마켓 목록 항목 — 판매 중인 카드만 온다 */
export interface MarketPhotocard {
  photocardId: number;
  listingId: number;
  designName: string;
  imageUrl: string | null;
  performanceTitle: string | null;
  eventName?: string | null;
  /** 판매가(CAT) */
  price: number;
  sellerNickname: string;
  viewCount: number;
}

/**
 * 카드 그림 한 장 (템플릿).
 *
 * 🔴 **카드(소유물)가 아니라 그림입니다.** 누가 무엇을 가졌는지와 무관하게,
 * 서버에 등록된 도안 전체가 내려옵니다. 마켓(`MarketPhotocard`)은 **판매 중인 카드**라
 * 아무도 안 올리면 0장이지만, 이쪽은 관리자가 올린 그림이라 항상 있습니다.
 */
export interface PhotocardArt {
  templateId: number;
  name: string;
  imageUrl: string | null;
}

/** 사용자별 도감 한 칸. 미보유이면 앞면 정보는 서버부터 null로 가립니다. */
export interface DrawPoolCard {
  designId: number;
  owned: boolean;
  name: string | null;
  imageUrl: string | null;
  group: string | null;
  grade: PocaGrade | null;
  acquisition: {
    type: 'PERFORMANCE' | 'EVENT';
    /** 공연명이거나, 전역 풀이라면 이벤트 포토카드 팩 이름입니다. */
    name: string;
  };
  count: number;
  marketCount: number;
  marketState: 'LISTED' | 'AUCTION' | 'SETTLING' | null;
  photocardId: number | null;
}

export interface PocaDexResponse {
  cards: DrawPoolCard[];
  /** 발행 중이거나 거래 정산 중인 내 카드 수 */
  pendingCount: number;
}

/** 내 포카 목록 항목 */
/**
 * 뽑기 풀 도안에만 붙는 값들. **공연 좌석에서 발행된 카드에는 없습니다**(서버가 생략).
 * 없으면 화면은 이름만 · 금색으로 물러섭니다 — 추측해서 호칭을 붙이지 않습니다.
 */
export interface PocaDesignInfo {
  /** 같은 도안의 지난 거래 평균가(CAT). 거래가 없으면 null */
  averagePrice?: number | null;
  /** 소속 — '서울 5반' · '15기' · '개발자' */
  group?: string;
  grade?: PocaGrade;
}

export interface MyPhotocard extends PocaDesignInfo {
  photocardId: number;
  /**
   * 어떤 도안인가. 🔴 **도감이 보유 여부를 맞추는 열쇠입니다.**
   * 이름으로 맞추면 운영자가 도안 이름을 바꾸는 순간 도감의 보유 표시가 통째로 어긋납니다.
   */
  designId: number;
  designName: string;
  imageUrl: string | null;
  /** 🔴 뽑기로 얻은 카드는 **null** 입니다 — 공연에서 나온 카드가 아닙니다 */
  performanceTitle: string | null;
  /** 이벤트 카드팩에서 나왔으면 그 이벤트 이름. 아니면 null (`photocardSource`) */
  eventName?: string | null;
  status: PhotocardMintStatus;
  viewCount: number;
  /** 판매 등록 여부. 가격은 오지 않는다 (서버 미결) */
  listed: boolean;
  /** 고정가/경매 구분. 판매 중이 아니면 null */
  marketType?: PhotocardMarketType | null;
  /** ACTIVE 또는 온체인 정산 중. 판매 중이 아니면 null */
  marketStatus?: PhotocardMarketStatus | null;
}

/**
 * 내가 가진 **같은 도안 카드 한 장**.
 *
 * 🔴 공연명이 없습니다 — 공연명은 포토카드가 아니라 **도안**에 붙어 있어서 같은 도안
 * 세 장은 전부 같은 공연명입니다. 실제로 갈리는 것은 회차와 좌석이고, 화면은 이미
 * 공연명을 알고 있습니다(상세가 띄우고 있는 그 카드의 공연입니다).
 *
 * ⚠️ 뽑기로 얻은 카드는 티켓이 없어 `origin` 과 회차가 모두 null 입니다.
 * 그때 갈라 보는 기준은 발행 시각뿐입니다.
 */
export interface MyDesignCopy {
  photocardId: number;
  issuedAt: string;
  /** 좌석. 뽑기 카드는 null */
  origin: PhotocardOrigin | null;
  /** 몇 회차인가. 뽑기 카드는 null */
  performanceNum: number | null;
  /** 그 회차의 공연 일시. 뽑기 카드는 null */
  performanceDate: string | null;
  status: PhotocardMintStatus;
  /** 판매 중이 아니면 null — 장마다 다릅니다 */
  marketType?: PhotocardMarketType | null;
  marketStatus?: PhotocardMarketStatus | null;
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
  isMine?: boolean;
  photocardId: number;
  /** 내가 가진 같은 도안 카드를 물을 때 쓰는 열쇠 (`nftApi.myCopies`) */
  designId: number;
  designName: string;
  imageUrl: string | null;
  /** 🔴 뽑기로 얻은 카드는 **null** 입니다 */
  performanceTitle: string | null;
  /** 이벤트 카드팩에서 나왔으면 그 이벤트 이름. 아니면 null (`photocardSource`) */
  eventName?: string | null;
  ownerNickname: string;
  issuedAt: string;
  /** 🔴 뽑기로 얻은 카드는 **null** — 좌석에서 나온 것이 아닙니다 */
  origin: PhotocardOrigin | null;
  status: PhotocardMintStatus;
  /** 판매 중이 아니면 null. 서버 봉투가 null 을 생략할 수도 있어 undefined 도 허용 */
  listing?: {
    listingId: number;
    status: ListingStatus;
    price: number;
    sellerDescription: string;
    listedAt: string;
  } | null;
  /** 경매 중이 아니면 null. 화면은 경매 브랜치에서 그린다 */
  auction?: {
    auctionId: number;
    status: 'ACTIVE' | 'SETTLING';
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

export interface PhotocardViewResult {
  viewCount: number;
  counted: boolean;
}

/** 구매(P5) 응답 */
export type TradeSettlementStatus =
  | 'PENDING'
  | 'CAT_SUBMITTED'
  | 'CAT_CONFIRMED'
  | 'NFT_SUBMITTED'
  | 'COMPLETED'
  | 'COMPENSATING'
  | 'REFUND_SUBMITTED'
  | 'COMPENSATED'
  | 'FAILED'
  | 'MANUAL_REVIEW';

export interface PurchaseResult {
  tradeId: number;
  photocardId: number;
  price: number;
  tradedAt?: string | null;
  status: TradeSettlementStatus;
  completedAt?: string | null;
  failureCode?: string | null;
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

/** `GET /photocards/draw` 응답 — 남은 카드팩 */
export interface PocaDrawStatus {
  /** 지금 뽑을 수 있는가 (`remaining > 0`) */
  available: boolean;
  /** 지금 열 수 있는 카드팩 수 */
  remaining: number;
  /**
   * 아직 못 여는 카드팩 수. **결제 직후부터 여기에 잡힙니다** —
   * 팩은 산 순간 생기고, 여는 것만 공연 직전으로 미뤄집니다.
   */
  scheduled: number;
  /** 개봉 시각은 지났지만 등록 완료된 잔여 카드가 없어 기다리는 팩 수 */
  preparing: number;
  /** 가장 빨리 열리는 시각. 잠긴 팩이 없으면 null */
  nextOpenAt: string | null;
  /**
   * 안 쓴 카드팩 **한 개씩** — 열 수 있는 팩이 먼저, 그다음 개봉이 이른 순입니다.
   * 서버는 최대 50개까지만 주므로 전체 수는 `remaining`·`scheduled` 가 답합니다.
   * 옛 서버는 이 필드를 주지 않습니다.
   */
  packs?: PocaDrawPack[];
}

/**
 * 카드팩 한 개.
 *
 * 🔴 `openAt` 은 **저장된 값이 아니라 서버가 계산한 값**입니다(회차의 공연 일시에서 뺍니다).
 * 공연이 연기되면 이 값도 함께 밀리므로, 화면이 값을 오래 들고 있지 말고 응답을 새로 받으세요.
 */
export interface PocaDrawPack {
  packId: number;
  /** TICKET_PURCHASE 예매 · TICKET_ENTRY 입장 · EVENT 이벤트 */
  source: string;
  /** 어디서 받은 팩인지 — 예매 팩은 공연명, 이벤트 팩은 이벤트 이름. 알 수 없으면 null */
  title: string | null;
  /** 개봉 시각. 이벤트 팩처럼 언제든 열 수 있으면 null */
  openAt: string | null;
  status: 'OPENABLE' | 'SCHEDULED' | 'PREPARING';
  /** 지금 열 수 있는가 — 서버가 DB 시계로 판정합니다 */
  openable: boolean;
}

/** `GET /users/me/photocards/summary` — 도감이 필요로 하는 도안별 보유 요약 */
export interface MyPhotocardSummary {
  designs: MyPhotocardSummaryDesign[];
  /**
   * 발행 중이거나 정산 중인 카드 수. 0 이면 화면이 다시 물어볼 이유가 없습니다.
   */
  pendingCount: number;
}

export interface MyPhotocardSummaryDesign {
  designId: number;
  /** 가진 장수 */
  count: number;
  /** 그중 마켓에 나간 장수 (`count` 에서 빼지 않습니다) */
  marketCount: number;
  /** 마켓에 나간 것 중 대표 한 장의 상태. 없으면 null */
  marketState: 'LISTED' | 'AUCTION' | 'SETTLING' | null;
  /** 눌렀을 때 열 대표 카드 — 서버가 보관 중인 카드를 먼저 고릅니다 */
  photocardId: number;
}

/** `POST /photocards/packs/claim` 응답 — 이벤트 팩 받기 */
export interface PocaPackClaim {
  /** 이번 요청으로 받았는가. 이미 받았거나 이벤트가 없으면 false (에러 아님) */
  granted: boolean;
  remaining: number;
}

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
