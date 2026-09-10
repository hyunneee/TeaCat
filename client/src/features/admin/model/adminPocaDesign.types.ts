/**
 * 포토카드 도안 관리 타입 — 서버 `NftPhotocardDesignAdminController` 계약 그대로입니다.
 *
 * 도안은 **뽑기 풀**(공연 없이, 소속·등급을 가짐)과 **공연 도안**(그 공연 전용) 둘로 나뉩니다.
 * 서버가 `drawPool == (performanceId != null)` 이면 거절하므로, 화면도 둘 중 하나만 채웁니다.
 */

/** 도안이 온체인에 올라갔는가 */
export type PocaDesignChainStatus = 'PENDING' | 'REGISTERING' | 'REGISTERED' | 'FAILED';

/** 뽑기 연출 등급 — 금색(코치·교육생) / 보라(개발자) */
export type PocaDesignGrade = 'SPECIAL' | 'COMMON';

export interface AdminPocaDesign {
  /** 이 값이 그대로 온체인 tokenId 입니다 */
  designId: number;
  /** 뽑기 풀 도안이면 null */
  performanceId: number | null;
  drawPool: boolean;
  /** 뽑기 풀 도안만 — '서울 5반' · '15기' · '개발자' */
  group: string | null;
  grade: PocaDesignGrade | null;
  name: string;
  /** IPFS 게이트웨이 주소 */
  imageUrl: string | null;
  /** 온체인 maxSupply. 🔴 첫 장이 발급되면 동결됩니다 */
  totalSupply: number;
  issuedCount: number;
  imageCid: string | null;
  metadataCid: string | null;
  metadataUri: string | null;
  chainStatus: PocaDesignChainStatus;
  chainId: number | null;
  contractAddress: string | null;
  registerTxHash: string | null;
  registeredAt: string | null;
}

/**
 * 도안 등록 요청 (multipart).
 *
 * 🔴 그림 파일과 함께 갑니다 — 서버가 IPFS 에 핀하고 온체인 등록까지 합니다.
 * 프론트는 IPFS 를 모릅니다(키도 없습니다).
 */
export interface AdminPocaDesignCreateRequest {
  name: string;
  description?: string;
  totalSupply: number;
  image: File;
  /** 뽑기 풀이면 true — 이때 group·grade 필수, performanceId 는 비웁니다 */
  drawPool: boolean;
  group?: string;
  grade?: PocaDesignGrade;
  performanceId?: number;
}
