package com.teacat.server.wallet.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.teacat.server.wallet.entity.CatTxStatus;

/**
 * 트랜잭션 확정 조회 응답 (GET /internal/tx/{txHash}).
 *
 * <p>체인이 실패를 알려준 것도 200 이다 — 조회 자체는 성공했으니까
 * (blockchain/DESIGN.md 7장). 체인이 해시 자체를 모르면 404 라서 이 타입으로 오지 않는다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TxReportResult(String status, String txHash, Long blockNumber, Error error) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Error(String code, String message) {
    }

    /**
     * 우리 상태값으로 옮긴다. 이름이 같아 그대로 매핑되지만, 모르는 값이 오면
     * 조용히 확정 처리하지 않고 PENDING 으로 남겨 다음 폴링이 다시 보게 한다.
     */
    public CatTxStatus toCatTxStatus() {
        try {
            return CatTxStatus.valueOf(status);
        } catch (IllegalArgumentException | NullPointerException e) {
            return CatTxStatus.PENDING;
        }
    }

    public String failureCode() {
        return error == null ? null : error.code();
    }
}
