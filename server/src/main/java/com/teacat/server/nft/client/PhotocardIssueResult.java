package com.teacat.server.nft.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * POST /internal/photocards/issue 응답.
 *
 * <p><b>202 로 먼저 끝나고 블록은 10초 뒤에 온다.</b> Spring 은 이 txHash 를 폴링하지 않는다 —
 * 블록체인 서비스가 확정을 기다렸다가 {@code nft_photocards} 를 직접
 * {@code MINTING → MINTED} 로 옮긴다. 우리는 자기 행의 status 가 바뀌는 걸로 안다.
 * (blockchain/DESIGN.md 1장 예외)
 *
 * @param count 이 트랜잭션에 담긴 카드 수
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PhotocardIssueResult(
        String status,
        String txHash,
        int count
) {
}
