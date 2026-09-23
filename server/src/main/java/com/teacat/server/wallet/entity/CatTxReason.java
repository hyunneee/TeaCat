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
    /**
     * 같이 하는 게임에서 받은 상금.
     *
     * <p>🔴 {@link #REWARD} 와 나눠 둔다. 출석 보상은 우리가 푼 돈이 전부지만 이건 대부분
     * 진 사람이 낸 판돈이 건너온 것이라, 둘을 같이 세면 "우리가 푼 돈" 이 크게 부풀려진다.
     * 실제로 새로 생긴 돈은 판마다 얹어주는 보조금(인원수 × 정액)뿐이다.
     */
    GAME_PRIZE(CatTxDirection.MINT),

    /** 티켓 결제 */
    PAYMENT(CatTxDirection.BURN),
    /** 원화 출금 */
    WITHDRAWAL(CatTxDirection.BURN),
    /** 관리자가 테스트용으로 뺀 돈. 원화를 돌려주지 않으므로 {@link #ADMIN_GRANT} 와 같이 대사에서 뺀다 */
    ADMIN_BURN(CatTxDirection.BURN),
    /** 같이 하는 게임에서 잃은 판돈. 티켓 결제가 아니므로 {@link #PAYMENT} 와 섞지 않는다 */
    GAME_BET(CatTxDirection.BURN),
    /**
     * 하루 무료 몫을 넘겨 만든 AI 스티커 값.
     *
     * <p>{@link #PAYMENT} 와 섞지 않는다 — 재사용하면 원장에 <b>있지도 않은 티켓 매출</b>이 잡힌다.
     * 실패한 생성은 {@link #REFUND} 로 돌려준다.
     */
    STICKER_CREATE(CatTxDirection.BURN);

    private final CatTxDirection direction;

    CatTxReason(CatTxDirection direction) {
        this.direction = direction;
    }

    public CatTxDirection direction() {
        return direction;
    }
}
