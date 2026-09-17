package com.teacat.server.nft.entity;

/** DB 의 nft_auction_status ENUM 과 1:1 */
public enum NftAuctionStatus {
    ACTIVE,
    /** 온체인 캣머니·포토카드 정산 중 */
    SETTLING,
    /** 낙찰 또는 즉시구매로 체결 */
    SOLD,
    /** 입찰 없이 마감(유찰) */
    EXPIRED,
    /** 판매자가 입찰 전 취소 */
    CANCELLED
}
