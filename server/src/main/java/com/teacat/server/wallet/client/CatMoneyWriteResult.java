package com.teacat.server.wallet.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * 캣머니 발행·소각 응답 (POST /internal/tokens/catmoney/mint|burn).
 *
 * @param status  방금 보냈으면 PENDING, 이미 처리돼 있었으면 ALREADY_DONE
 * @param txHash  ALREADY_DONE 이면 새 트랜잭션이 없어 null
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CatMoneyWriteResult(String status, String txHash) {

    private static final String PENDING = "PENDING";

    /** 새 트랜잭션이 나갔는가. 아니면 컨트랙트에 이미 실행돼 있었다는 뜻이다 */
    public boolean isPending() {
        return PENDING.equals(status) && txHash != null;
    }
}
