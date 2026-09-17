package com.teacat.server.nft.entity;

public enum NftTradeChainStatus {
    PENDING,
    CAT_SUBMITTED,
    CAT_CONFIRMED,
    NFT_SUBMITTED,
    COMPLETED,
    COMPENSATING,
    REFUND_SUBMITTED,
    COMPENSATED,
    FAILED,
    MANUAL_REVIEW;

    public boolean isTerminal() {
        return this == COMPLETED || this == COMPENSATED || this == FAILED || this == MANUAL_REVIEW;
    }
}
