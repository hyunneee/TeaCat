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
 * <p>결제 응답 안에서 할 수 없는 일들입니다 — 앞의 둘은 <b>사용자를 기다리게 하지 않으려고</b>
 * 밖으로 뺐고, 마지막은 사용자가 아예 돌아오지 않는 경우입니다. 아무도 다시 시도하지 않으므로
 * 여기가 그 자리입니다.
 *
 * <ol>
 *   <li><b>캣머니 소각</b> — 결제는 끝났는데 체인 요청이 실패했거나 그 사이 서버가 죽은 경우
 *   <li><b>NFT 티켓 발행</b> — 같은 이유. 발행 안 된 티켓도 예매 자체는 유효하다
 *   <li><b>버려진 주문 정리</b> — 결제창을 닫고 돌아오지 않아 PENDING 으로 남은 주문
 * </ol>
 *
 * <p>모두 멱등이라 다시 실행해도 두 번 반영되지 않습니다.
 * {@code CatTransactionScheduler} 와 마찬가지로 <b>인스턴스가 하나라는 전제</b>입니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TicketOrderScheduler {

    private static final Limit BATCH_SIZE = Limit.of(50);

    private final TicketOrderRepository ticketOrderRepository;
    private final TicketOrderService ticketOrderService;
    private final TicketOrderRecorder ticketOrderRecorder;
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
     * 좌석 선점을 잃은 채 남은 결제 대기 주문을 닫는다.
     *
     * <p>결제창을 닫고 돌아오지 않으면 주문이 PENDING 으로 남는다. 그대로 두면 묶어둔 캣머니가
     * 풀리지 않아 그 사람 가용 잔액이 계속 깎이고, {@code uq_ticket_orders_pending_seat} 때문에
     * <b>그 좌석으로는 누구도 주문을 열 수 없다</b>.
     *
     * <p>선점이 살아 있는 주문은 건드리지 않으므로 결제 중인 사람을 끊지 않는다.
     */
    @Scheduled(
            fixedDelayString = "${payment.recovery.interval}",
            initialDelayString = "${payment.recovery.initial-delay}")
    public void expireStalePendingOrders() {
        for (Long ticketOrderId : ticketOrderRepository.findStalePendingOrderIds(BATCH_SIZE.max())) {
            ticketOrderRecorder.expireStale(ticketOrderId);
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
