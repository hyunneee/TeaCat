package com.teacat.server.wallet.entity;

/** DB 의 wallet_seed_status ENUM 과 1:1 */
public enum WalletSeedStatus {
    /** 트랜잭션을 보냈고 아직 확정되지 않음 */
    PENDING,
    /** 체인에서 확정을 확인함 */
    CONFIRMED,
    /** 이미 발행돼 있어 새로 보내지 않음 (재시도) */
    ALREADY_DONE
}
