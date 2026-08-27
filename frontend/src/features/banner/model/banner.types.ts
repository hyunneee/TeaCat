/** 배너를 누르면 어디로 가는가 */
export type BannerLinkType =
  | 'CONCERT' // 공연 상세
  | 'NFT' // 포토카드 마켓
  | 'TOKEN' // 토큰 채굴
  | 'NONE'; // 안내만 (이동 없음)

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  /** 좌상단 라벨 (EVENT / 오픈 예정 등) */
  label: string;
  /** 실제 이미지가 없을 때 그라데이션을 만드는 시드 */
  artSeed: string;
  imageUrl?: string | null;
  linkType: BannerLinkType;
  /** linkType 이 CONCERT 면 concertId */
  linkId?: string | null;
}
