package com.teacat.server.nft.entity;

public enum NftMintStatus {
    PENDING,
    MINTING,
    MINTED,
    FAILED,
    /**
     * 소각됨 (예매 취소).
     *
     * <p>블록체인 서비스는 이 값을 쓰지 않는다 — 그쪽은 burn_tx_hash 만 남기고,
     * 상태 전이는 취소를 트리거한 우리가 한다.
     */
    BURNED
}

