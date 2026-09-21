package com.teacat.server.nft.entity;

public enum NftTradeChainStatus {
    PENDING,
    /**
     * 이상거래 심사에 걸려 체인 전송 전에 멈춤. 구매자·판매자 홀드는 그대로, 카드도 판매자 소유 그대로다.
     * 정산 스케줄러가 집지 않는다. 관리자가 승인하면 PENDING 으로 돌아가고, 거절하면 FAILED(RISK_REJECTED) 다.
     * MANUAL_REVIEW 와 다르다 — 그건 "체인에 뭔가 나갔을 수 있어 자동 처리를 멈춘" 상태다.
     */
    RISK_REVIEW,
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
