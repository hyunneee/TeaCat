package com.teacat.server.wallet.entity;

/** DB 의 wallet_type ENUM 과 1:1. 지금은 릴레이어 EOA 만 쓴다 (blockchain/DESIGN.md 5-2) */
public enum WalletType {
    RELAYER_EOA,
    SMART_ACCOUNT
}
