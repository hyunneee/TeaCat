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
    /**
     * 관리자가 테스트용으로 넣어준 돈.
     *
     * <p>🔴 <b>대사(reconciliation) 대상이 아니다.</b> 실제 원화가 들어온 적이 없으므로
     * {@link #DEPOSIT} 과 함께 세면 원화 장부와 반드시 어긋난다. 매출·충전 집계에서 빼야 한다.
     */
    ADMIN_GRANT(CatTxDirection.MINT),

    /** 티켓 결제 */
    PAYMENT(CatTxDirection.BURN),
    /** 원화 출금 */
    WITHDRAWAL(CatTxDirection.BURN),
    /** 관리자가 테스트용으로 뺀 돈. 원화를 돌려주지 않으므로 {@link #ADMIN_GRANT} 와 같이 대사에서 뺀다 */
    ADMIN_BURN(CatTxDirection.BURN);

    private final CatTxDirection direction;

    CatTxReason(CatTxDirection direction) {
        this.direction = direction;
    }

    public CatTxDirection direction() {
        return direction;
    }
}
