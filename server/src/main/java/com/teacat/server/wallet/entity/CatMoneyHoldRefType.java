package com.teacat.server.wallet.entity;

/** 홀드의 출처. wallet 은 출처 도메인을 모르므로 (종류, id) 쌍으로만 기억한다 */
public enum CatMoneyHoldRefType {
    /** ref_id = nft_auction_bids.id */
    AUCTION_BID,
    /** ref_id = nft_auctions.id */
    AUCTION_BUY_NOW,
    /** ref_id = ticket_orders.id. 결제가 끝나면 CAPTURED(소각), 무산되면 RELEASED */
    TICKET_ORDER
}
