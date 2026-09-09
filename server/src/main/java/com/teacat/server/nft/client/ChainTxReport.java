package com.teacat.server.nft.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * GET /internal/tx/{txHash} 응답. <b>쓰기의 최종 성공 여부는 여기서 본다.</b>
 *
 * <p>블록체인 API 는 체인의 revert 도 200 으로 내려준다 — 조회 자체는 성공했기 때문이다.
 * 그래서 {@code FAILED} 는 서버 장애가 아니라 정상적인 조회 결과다. (blockchain/DESIGN.md 7장)
 *
 * @param status PENDING · CONFIRMED · FAILED · ALREADY_DONE
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChainTxReport(
        String status,
        String txHash,
        Integer blockNumber
) {

    /** 확정. ALREADY_DONE 은 "다른 트랜잭션이 이미 해냈다" 는 뜻이라 성공의 다른 모양이다 */
    public boolean isSettled() {
        return "CONFIRMED".equals(status) || "ALREADY_DONE".equals(status);
    }

    public boolean isFailed() {
        return "FAILED".equals(status);
    }
}
