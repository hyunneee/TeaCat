/**
 * 포토카드 템플릿·도안 관리 타입 — 서버 계약 그대로입니다.
 *
 * ── 템플릿과 도안은 다른 것입니다 ────────────────────────────
 *   템플릿  그림 한 장 (IPFS 에 한 번 올림). **수량이 없습니다**
 *   도안    그 그림을 **어디에 몇 장** 풀지 정한 것. 온체인 카드 한 종류
 *
 * 같은 템플릿으로 공연 A·B 에 넣으면 **서로 다른 온체인 카드**가 됩니다
 * (tokenId 가 다르고 마켓에서 따로 거래됩니다). 그림만 같습니다.
 */

/** 도안이 온체인에 올라갔는가 */
export type PocaDesignChainStatus = 'PENDING' | 'REGISTERING' | 'REGISTERED' | 'FAILED';

/** 뽑기 연출 등급 — 금색(코치·교육생) / 보라(개발자) */
export type PocaDesignGrade = 'SPECIAL' | 'COMMON';

/** 카드 그림 한 장. 수량은 여기 없습니다 */
export interface AdminPocaTemplate {
  templateId: number;
  name: string;
  description: string | null;
  /** IPFS 게이트웨이 주소 — `<img src>` 에 그대로 넣습니다 */
  imageUrl: string;
  group: string;
  grade: PocaDesignGrade;
  /** 목록에는 항상 false — 감춘 템플릿은 내려오지 않습니다 */
  hidden: boolean;
  /** 이 템플릿으로 만든 도안 수 (공연 + 이벤트 합계) */
  usedCount: number;
  createdAt: string;
}

/** 템플릿 등록 (multipart). 🔴 수량을 받지 않습니다 */
export interface AdminPocaTemplateCreateRequest {
  name: string;
  description?: string;
  image: File;
  group: string;
  grade: PocaDesignGrade;
}

export interface AdminPocaDesign {
  /** 이 값이 그대로 온체인 tokenId 입니다 */
  designId: number;
  /** 이벤트 풀 도안이면 null */
  performanceId: number | null;
  drawPool: boolean;
  /** 템플릿 없이 직접 등록된 옛 도안은 null */
  templateId: number | null;
  /** `totalSupply - issuedSupply` */
  remaining: number;
  group: string | null;
  grade: PocaDesignGrade | null;
  /** `"{템플릿 이름} · {공연 제목}"` */
  name: string;
  imageUrl: string | null;
  /** 온체인 maxSupply. 🔴 첫 장이 발급되면 동결됩니다 */
  totalSupply: number;
  issuedSupply: number;
  imageCid: string | null;
  metadataCid: string | null;
  metadataUri: string | null;
  chainStatus: PocaDesignChainStatus;
  chainId: number | null;
  contractAddress: string | null;
  registerTxHash: string | null;
  registeredAt: string | null;
}

/** 한 공연의 뽑기 풀 */
export interface AdminPerformanceDrawPool {
  /** 전 회차 좌석 합계 = 구역 정원 합 × 회차 수 */
  seatCapacity: number;
  /** 이 공연 도안들의 잔여 합계 */
  poolRemaining: number;
  /** `poolRemaining >= seatCapacity` */
  sufficient: boolean;
  designs: AdminPocaDesign[];
}

/** 풀에 넣을 한 줄 — 템플릿 하나를 몇 장 풀지 */
export interface PocaPoolItem {
  templateId: number;
  /** 🔴 온체인 maxSupply 로 박힙니다. 첫 장이 나가면 되돌릴 수 없습니다 */
  totalSupply: number;
}

/**
 * 아직 서버에 보내지 않은 풀 선택값.
 *
 * 수량 입력 중에는 빈 문자열도 유효한 화면 상태라 `PocaPoolItem`과 분리합니다.
 * 키가 있으면 템플릿을 고른 것이고, 값은 숫자 입력창의 원문입니다.
 */
export type PocaPoolSelection = Record<number, string>;
