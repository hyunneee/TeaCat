export interface Nft {
  id: string;
  name: string;
  /** 아트를 생성하는 시드 (실제 이미지가 생기면 imageUrl 로 대체) */
  artSeed: string;
  imageUrl?: string | null;
  /** 어느 좌석에서 나온 포카인지 */
  seatLabel: string;
  /** 마켓에 올라와 있으면 가격(포도알), 아니면 null */
  listPrice: number | null;
  /** 판매자가 붙인 설명. 판매를 내리면 사라집니다. */
  description: string | null;
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

/** 포카 거래 한 건 (구매 또는 판매) */
export interface NftTrade {
  id: string;
  nftId: string;
  nftName: string;
  concertTitle: string;
  artSeed: string;
  imageUrl?: string | null;
  /** 내가 산 건지 판 건지 */
  type: 'BUY' | 'SELL';
  /** 오간 포도알 */
  price: number;
  tradedAt: string;
  /** 거래 상대 */
  counterpartyName: string;
}
