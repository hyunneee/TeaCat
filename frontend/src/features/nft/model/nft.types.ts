/** 포토카드 등급 */
export type Rarity = 'NORMAL' | 'RARE' | 'SPECIAL';

export interface Nft {
  id: string;
  name: string;
  rarity: Rarity;
  /** 아트를 생성하는 시드 (실제 이미지가 생기면 imageUrl 로 대체) */
  artSeed: string;
  imageUrl?: string | null;
  /** 어느 좌석에서 나온 포카인지 */
  seatLabel: string;
  /** 마켓에 올라와 있으면 가격(토큰), 아니면 null */
  listPrice: number | null;
  mintedAt: string;

  concertId: string;
  concertTitle: string;
  artist: string;

  ownerId: string;
  ownerName: string;
}

export interface TokenBalance {
  balance: number;
  symbol: string;
}
