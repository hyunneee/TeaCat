package com.teacat.server.wallet.entity;

/** DB 의 cat_tx_direction ENUM 과 1:1. 캣머니는 발행과 소각으로만 움직인다 (blockchain/DESIGN.md 6장 ②) */
public enum CatTxDirection {
    MINT,
    BURN
}
