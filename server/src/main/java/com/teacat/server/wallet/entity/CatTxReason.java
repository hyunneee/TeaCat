package com.teacat.server.wallet.entity;

/**
 * DB 의 cat_tx_reason ENUM 과 1:1.
 *
 * 블록체인 서비스의 mint/burn 요청 본문 {@code reason} 과 같은 값이라 이름을 그대로 보낸다.
 * 발행 사유와 소각 사유는 겹치지 않는다 — DB CHECK 도 같은 규칙을 건다.
 */
public enum CatTxReason {

    /** 원화 입금이 확인됨 (토큰 충전) */
    DEPOSIT(CatTxDirection.MINT),
    /** 이벤트·보상 지급 */
    REWARD(CatTxDirection.MINT),
    /** 예매 취소 환급 */
    REFUND(CatTxDirection.MINT),

    /** 티켓 결제 */
    PAYMENT(CatTxDirection.BURN),
    /** 원화 출금 */
    WITHDRAWAL(CatTxDirection.BURN);

    private final CatTxDirection direction;

    CatTxReason(CatTxDirection direction) {
        this.direction = direction;
    }

    public CatTxDirection direction() {
        return direction;
    }
}
