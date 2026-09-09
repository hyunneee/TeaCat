package com.teacat.server.payment.service;

import com.teacat.server.payment.entity.TicketOrder;
import com.teacat.server.payment.entity.TicketOrderStatus;
import com.teacat.server.payment.repository.TicketOrderRepository;
import com.teacat.server.ticket.service.TicketBurnService;
import com.teacat.server.ticket.service.TicketIssueService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Limit;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 결제가 끝난 뒤 뒤따라가야 할 일들을 되살립니다.
 *
 * <p>둘 다 <b>사용자를 기다리게 하지 않으려고</b> 결제 응답 밖으로 뺀 작업입니다. 그래서 그때
 * 실패하면 아무도 다시 시도하지 않습니다 — 여기가 그 자리입니다.
 *
 * <ol>
 *   <li><b>캣머니 소각</b> — 결제는 끝났는데 체인 요청이 실패했거나 그 사이 서버가 죽은 경우
 *   <li><b>NFT 티켓 발행</b> — 같은 이유. 발행 안 된 티켓도 예매 자체는 유효하다
 * </ol>
 *
 * <p>둘 다 멱등 키가 있어 다시 보내도 두 번 실행되지 않습니다.
 * {@code CatTransactionScheduler} 와 마찬가지로 <b>인스턴스가 하나라는 전제</b>입니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TicketOrderScheduler {

    private static final Limit BATCH_SIZE = Limit.of(50);

    private final TicketOrderRepository ticketOrderRepository;
    private final TicketOrderService ticketOrderService;
    private final TicketIssueService ticketIssueService;
    private final TicketBurnService ticketBurnService;
    private final TicketCancelService ticketCancelService;
    private final TicketCancelRecorder ticketCancelRecorder;

    /**
     * 방금 만든 티켓은 블록체인 서비스가 아직 전송 기록을 남기기 전일 수 있다.
     * 그만큼 지난 것만 재시도 대상으로 본다.
     */
    @Value("${payment.recovery.settle-after}")
    private Duration settleAfter;

    @Scheduled(
            fixedDelayString = "${payment.recovery.interval}",
            initialDelayString = "${payment.recovery.initial-delay}")
    public void retryMissingBurns() {
        List<TicketOrder> unburned = ticketOrderRepository
                .findByStatusAndBurnTxIsNullAndTokenAmountGreaterThanOrderByIdAsc(
                        TicketOrderStatus.PAID, 0, BATCH_SIZE);

        for (TicketOrder order : unburned) {
            // sendBurn 은 스스로 예외를 삼키고 로그를 남긴다
            ticketOrderService.sendBurn(order.getId());
        }
    }

    @Scheduled(
            fixedDelayString = "${payment.recovery.interval}",
            initialDelayString = "${payment.recovery.initial-delay}")
    public void retryMissingIssues() {
        List<Long> unissued = ticketIssueService.findUnissued(
                LocalDateTime.now().minus(settleAfter), BATCH_SIZE);

        for (Long ticketId : unissued) {
            ticketIssueService.requestIssue(ticketId);
        }
    }

    /**
     * 환불은 반드시 끝나야 하는 빚이다. 실패한 것을 끝까지 따라간다.
     *
     * <p>카드 취소·캣머니 환급·NFT 소각 모두 멱등이라 다시 보내도 두 번 실행되지 않는다.
     */
    @Scheduled(
            fixedDelayString = "${payment.recovery.interval}",
            initialDelayString = "${payment.recovery.initial-delay}")
    public void retryPendingRefunds() {
        for (Long ticketOrderId : ticketCancelRecorder.findUnrefundedCards(BATCH_SIZE)) {
            ticketCancelService.cancelCard(ticketOrderId);
        }
        for (Long ticketOrderId : ticketCancelRecorder.findUnrefundedTokens(BATCH_SIZE)) {
            ticketCancelService.refundToken(ticketOrderId);
        }
        for (Long ticketId : ticketBurnService.findUnburned(BATCH_SIZE)) {
            ticketBurnService.requestBurn(ticketId);
        }
    }
}
