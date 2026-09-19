package com.teacat.server.wallet.entity;

/** DB 의 wallet_provision_status ENUM 과 1:1 */
public enum WalletProvisionStatus {
    /** 가입은 됐고 지갑은 아직. 소비자 또는 스위퍼가 처리한다 */
    PENDING,
    /** wallet_owners / wallets 행이 생겼다 */
    DONE
}
