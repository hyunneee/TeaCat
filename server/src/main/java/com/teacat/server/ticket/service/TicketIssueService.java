package com.teacat.server.ticket.service;

import com.teacat.server.ticket.client.BlockchainTicketClient;
import com.teacat.server.ticket.client.TicketIssueResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * NFT 티켓(SBT) 발행 요청.
 *
 * <p><b>발행 실패는 예매 실패가 아닙니다.</b> 이 시점에 사용자는 이미 결제를 마쳤고 티켓도
 * 발권됐습니다. 여기서 예외를 던져 실패 화면을 보여주면 사용자는 다시 결제하려 합니다.
 * 그래서 실패를 삼키고 재시도에 맡깁니다 — 같은 {@code ticketKey} 로 다시 보내도 컨트랙트가
 * 두 장을 발행하지 않습니다.
 *
 * <p>확정(블록 10초)은 <b>기다리지 않습니다.</b> 블록체인 서비스가 대신 기다렸다가
 * {@code nft_tickets} 의 결과 컬럼을 직접 갱신합니다. 그래서 여기서 받은 tokenId·txHash 를
 * 우리가 저장하지 않습니다.
 *
 * <p>이 클래스에는 트랜잭션이 없습니다 — DB 기록은 {@link NftTicketRecorder} 가 짧게 처리하고
 * 체인 호출은 그 커밋 뒤에 일어납니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TicketIssueService {

    private final NftTicketRecorder recorder;
    private final BlockchainTicketClient blockchainTicketClient;

    /** 발행 대상을 확보하고 요청을 보낸다. 이미 요청이 나갔으면 아무것도 하지 않는다 */
    public void requestIssue(Long ticketId) {
        Optional<NftTicketRecorder.IssueTarget> target;
        try {
            target = recorder.prepare(ticketId);
        } catch (RuntimeException e) {
            log.error("NFT 티켓 발행 대상을 만들지 못했습니다. ticketId={}", ticketId, e);
            return;
        }
        if (target.isEmpty()) {
            return;
        }

        try {
            TicketIssueResult result = blockchainTicketClient.issue(
                    target.get().ticketKey(), target.get().address());

            // 결과를 우리가 쓰지 않는다 — status·token_id·mint_tx_hash 는 블록체인 서비스 소유다.
            // 여기서는 보냈다는 사실만 로그로 남긴다
            log.info("NFT 티켓 발행 요청 ticketId={} status={} tokenId={}",
                    ticketId, result.status(), result.tokenId());
        } catch (RuntimeException e) {
            log.error("NFT 티켓 발행을 요청하지 못했습니다. 재시도 대상입니다. ticketId={}", ticketId, e);
        }
    }

    /** 재시도 배치가 쓴다 */
    public List<Long> findUnissued(LocalDateTime createdBefore, Limit limit) {
        return recorder.findUnissued(createdBefore, limit);
    }
}
