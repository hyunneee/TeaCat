package com.teacat.server.wallet.entity;

/** 홀드의 출처. wallet 은 출처 도메인을 모르므로 (종류, id) 쌍으로만 기억한다 */
public enum CatMoneyHoldRefType {
    /** ref_id = nft_auction_bids.id */
    AUCTION_BID,
    /** ref_id = nft_auctions.id */
    AUCTION_BUY_NOW,
    /** ref_id = nft_photocard_trades.id. 고정가·즉시구매 구매자의 결제 예약 */
    NFT_TRADE_BUYER,
    /** ref_id = nft_photocard_trades.id. 보상 가능성을 위한 판매자 수령액 잠금 */
    NFT_TRADE_SELLER,
    /** ref_id = ticket_orders.id. 결제가 끝나면 CAPTURED(소각), 무산되면 RELEASED */
    TICKET_ORDER,
    /** ref_id = game_participants.id. 게임이 끝나면 CAPTURED, 판이 깨지면 RELEASED */
    GAME_BET
}
