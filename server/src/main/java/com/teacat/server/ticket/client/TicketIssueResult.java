package com.teacat.server.ticket.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * 티켓 SBT 발행 응답 (POST /internal/tickets/issue).
 *
 * @param status  방금 보냈으면 PENDING, 이미 발행돼 있었으면 ALREADY_ISSUED
 * @param txHash  ALREADY_ISSUED 면 새 트랜잭션이 없어 null
 * @param tokenId ticketKey 에서 결정론적으로 나오는 번호. <b>두 경우 모두 채워진다.</b>
 *                단 PENDING 이면 아직 체인에 없는 번호다 — 입장 판정 전에 확정을 확인해야 한다
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TicketIssueResult(String status, String txHash, String tokenId) {

    private static final String PENDING = "PENDING";

    /** 새 트랜잭션이 나갔는가. 아니면 컨트랙트에 이미 발행돼 있었다는 뜻이다 */
    public boolean isPending() {
        return PENDING.equals(status);
    }
}
