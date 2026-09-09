package com.teacat.server.wallet.entity;

/** DB 의 cat_tx_status ENUM 과 1:1. 블록체인 서비스의 tx 조회 상태와 같은 이름이다 */
public enum CatTxStatus {

    /** 보냈고 아직 확정되지 않음. 소각이라면 이 몫만큼은 아직 쓸 수 없는 것으로 본다 */
    PENDING,
    /** 체인에서 확정을 확인함 */
    CONFIRMED,
    /**
     * 컨트랙트가 "이미 처리된 작업" 이라고 답함. 실패가 아니라 <b>성공의 다른 모양</b>이다 —
     * 그 작업은 다른 트랜잭션이 이미 해냈다는 뜻이다 (blockchain/DESIGN.md 7장)
     */
    ALREADY_DONE,
    /** 체인이 실행을 거부함(revert). 재시도하거나 사람이 봐야 한다 */
    FAILED;

    /** 체인에 반영이 끝났는가 (더 기다릴 필요가 없는가) */
    public boolean isSettled() {
        return this != PENDING;
    }

    /** 체인에 실제로 반영됐는가. FAILED 는 아무것도 바꾸지 않았다 */
    public boolean isEffective() {
        return this == CONFIRMED || this == ALREADY_DONE;
    }
}
