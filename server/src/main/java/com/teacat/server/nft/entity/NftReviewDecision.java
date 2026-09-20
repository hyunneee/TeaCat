package com.teacat.server.nft.entity;

/** DB 의 nft_review_decision ENUM 과 1:1 */
public enum NftReviewDecision {
    /** 정산 재개. decided_by 가 null 이면 시한 경과 자동 승인 */
    APPROVED,
    /** 홀드 해제, 거래 FAILED(RISK_REJECTED) */
    REJECTED
}
