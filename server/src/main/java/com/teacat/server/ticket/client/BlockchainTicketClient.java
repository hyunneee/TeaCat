package com.teacat.server.ticket.client;

import com.teacat.server.ticket.exception.TicketErrorCode;
import com.teacat.server.wallet.client.BlockchainRestClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * 티켓 SBT 발행 (POST /internal/tickets/issue).
 *
 * <p>보냈다는 응답(202)만 받고 <b>확정은 기다리지 않는다.</b> 그 10초를 블록체인 서비스가
 * 대신 기다렸다가 {@code tickets} 행을 직접 갱신한다 (blockchain/DESIGN.md 1장 "예외 하나").
 * 그래서 여기서 받은 tokenId·txHash 를 우리가 저장하지 않는다 — 그 컬럼은 저쪽 소유다.
 *
 * <p>같은 {@code ticketKey} 로 다시 보내도 두 장이 발행되지 않는다. 컨트랙트가 막는다.
 */
@Component
@RequiredArgsConstructor
public class BlockchainTicketClient {

    private static final String ISSUE_PATH = "/internal/tickets/issue";

    private final BlockchainRestClient blockchainRestClient;

    /**
     * @param ticketKey 우리가 만든 영구 유일 키 (tickets.ticket_key)
     * @param to        받는 주소. <b>반드시 우리가 파생한 지갑</b>이어야 한다 — 티켓은 양도가
     *                  불가능해서 엉뚱한 주소로 나가면 옮길 방법이 없다
     */
    public TicketIssueResult issue(UUID ticketKey, String to) {
        Map<String, Object> body = Map.of(
                "ticketKey", ticketKey.toString(),
                "to", to);

        return blockchainRestClient.post(
                ISSUE_PATH, body, TicketIssueResult.class, TicketErrorCode.TICKET_ISSUE_FAILED);
    }
}
