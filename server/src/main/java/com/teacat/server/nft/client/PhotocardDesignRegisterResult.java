package com.teacat.server.nft.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * POST /internal/photocards/designs 응답.
 *
 * @param status      PENDING(방금 보냄) 또는 ALREADY_DONE(같은 수량·같은 CID 로 이미 등록돼 있었음).
 *                    ALREADY_DONE 이 있어서 재시도가 안전하다
 * @param txHash      ALREADY_DONE 이면 새 트랜잭션이 없어 null
 * @param metadataUri 온체인 {@code uri(tokenId)} 가 돌려줄 값. {@code ipfs://} 는 블록체인 서비스가 붙인다
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PhotocardDesignRegisterResult(
        String status,
        String txHash,
        String designId,
        String maxSupply,
        String metadataUri
) {

    private static final String ALREADY_DONE = "ALREADY_DONE";

    /** 새 트랜잭션 없이 "이미 체인에 있다" 는 답. 확정을 기다릴 필요가 없다 */
    public boolean isAlreadyDone() {
        return ALREADY_DONE.equals(status);
    }
}
