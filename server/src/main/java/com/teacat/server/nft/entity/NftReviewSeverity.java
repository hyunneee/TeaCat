package com.teacat.server.nft.entity;

/** DB 의 nft_review_severity ENUM 과 1:1. 이상거래 규칙 신호의 무게 */
public enum NftReviewSeverity {
    LOW,
    MEDIUM,
    HIGH;

    public boolean atLeast(NftReviewSeverity other) {
        return ordinal() >= other.ordinal();
    }

    public static NftReviewSeverity max(NftReviewSeverity a, NftReviewSeverity b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.ordinal() >= b.ordinal() ? a : b;
    }
}
