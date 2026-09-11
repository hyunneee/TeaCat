package com.teacat.server.payment.service;

import com.teacat.server.booking.repository.PerformanceSeatRepository;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.payment.entity.Payment;
import com.teacat.server.payment.entity.PaymentCancel;
import com.teacat.server.payment.entity.TicketOrder;
import com.teacat.server.payment.entity.TicketOrderStatus;
import com.teacat.server.payment.exception.PaymentErrorCode;
import com.teacat.server.payment.repository.PaymentCancelRepository;
import com.teacat.server.payment.repository.TicketOrderRepository;
import com.teacat.server.ticket.entity.Ticket;
import com.teacat.server.wallet.entity.CatTransaction;
import com.teacat.server.wallet.repository.CatTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 예매 취소의 <b>DB 기록만</b> 담당합니다. 한 메서드가 곧 한 트랜잭션입니다.
 *
 * <p>결제와 순서가 반대입니다. 결제는 <b>돈을 먼저</b> 받고 티켓을 줬지만, 취소는
 * <b>티켓을 먼저 무효화</b>하고 돈을 돌려줍니다. 환불이 실패했을 때 "티켓도 못 쓰고 돈도
 * 못 받은" 상태는 우리가 재시도로 갚을 수 있지만, "티켓은 살아 있는데 환불은 끝난" 상태는
 * 되돌릴 방법이 없기 때문입니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TicketCancelRecorder {

    private final TicketOrderRepository ticketOrderRepository;
    private final PaymentCancelRepository paymentCancelRepository;
    private final PerformanceSeatRepository performanceSeatRepository;
    private final CatTransactionRepository catTransactionRepository;

    /**
     * 예매를 무효화한다. <b>환불보다 먼저</b> 커밋된다.
     *
     * <p>좌석은 바로 풀어 준다 — 취소된 자리를 남이 살 수 있어야 한다. 환불이 아직 안 끝났어도
     * 상관없다. 그건 우리와 사용자 사이의 빚이지 좌석의 문제가 아니다.
     */
    @Transactional
    public Invalidated invalidate(Long ticketOrderId, Long userId, LocalDateTime now) {
        TicketOrder order = ticketOrderRepository.findWithLockById(ticketOrderId)
                .orElseThrow(() -> new BusinessException(PaymentErrorCode.TICKET_ORDER_NOT_FOUND));

        if (!order.isOwnedBy(userId)) {
            throw new BusinessException(PaymentErrorCode.PAYMENT_OWNER_MISMATCH);
        }
        if (order.getStatus() == TicketOrderStatus.CANCELED) {
            throw new BusinessException(PaymentErrorCode.ALREADY_CANCELED);
        }
        if (order.getStatus() != TicketOrderStatus.PAID) {
            throw new BusinessException(PaymentErrorCode.PAYMENT_ALREADY_PROCESSED);
        }
        // 취소 마감은 공연 시작 시각까지다 (예매 정책). 설정이 아니라 회차의 공연 일시가 기준이다
        if (!order.getPerformanceDetail().getPerformanceDate().isAfter(now)) {
            throw new BusinessException(PaymentErrorCode.CANCEL_DEADLINE_PASSED);
        }

        Ticket ticket = order.getTicket();
        ticket.cancel();
        order.markCanceled();

        // 좌석을 되돌린다. 이미 남이 가져갔을 수는 없다 — SOLD 는 취소로만 풀린다
        performanceSeatRepository.release(
                order.getPerformanceDetail().getId(),
                order.getSeat() == null ? null : order.getSeat().getId());

        log.info("예매 취소 ticketOrderId={} ticketId={}", ticketOrderId, ticket.getId());

        return new Invalidated(order.getId(), ticket.getId(), order.getCashAmount(),
                order.getTokenAmount());
    }

    /** 카드 취소를 기록한다. 토스 호출이 성공한 뒤에 부른다 */
    @Transactional
    public void recordCardCancel(Long ticketOrderId, int amount, String reason,
            UUID idempotencyKey, String transactionKey) {
        // 재시도로 다시 들어온 경우. UNIQUE 제약이 최종 방어선이지만 여기서 먼저 거른다
        if (paymentCancelRepository.findByIdempotencyKey(idempotencyKey).isPresent()) {
            return;
        }

        TicketOrder order = ticketOrderRepository.findById(ticketOrderId).orElse(null);
        if (order == null || order.getPayment() == null) {
            return;
        }

        Payment payment = order.getPayment();
        paymentCancelRepository.save(
                PaymentCancel.of(payment, amount, reason, idempotencyKey, transactionKey));
        payment.applyCancel(amount);
    }

    @Transactional
    public void attachRefund(Long ticketOrderId, Long catTransactionId) {
        TicketOrder order = ticketOrderRepository.findById(ticketOrderId).orElse(null);
        if (order == null || order.getRefundTx() != null) {
            return;
        }

        CatTransaction refundTx = catTransactionRepository.findById(catTransactionId).orElse(null);
        if (refundTx != null) {
            order.recordRefund(refundTx);
        }
    }

    /** 카드 취소가 아직 안 끝난 주문. 환불은 반드시 끝나야 하므로 배치가 따라간다 */
    @Transactional(readOnly = true)
    public List<Long> findUnrefundedCards(Limit limit) {
        return ticketOrderRepository.findCanceledWithUnrefundedCard(limit);
    }

    /** 캣머니 환급이 아직 안 나간 주문 */
    @Transactional(readOnly = true)
    public List<Long> findUnrefundedTokens(Limit limit) {
        return ticketOrderRepository
                .findByStatusAndRefundTxIsNullAndTokenAmountGreaterThanOrderByIdAsc(
                        TicketOrderStatus.CANCELED, 0, limit)
                .stream()
                .map(TicketOrder::getId)
                .toList();
    }

    /** 환급을 보낼 때 필요한 값. 트랜잭션 밖에서 쓰므로 값으로 꺼낸다 */
    @Transactional(readOnly = true)
    public Optional<RefundTarget> findRefundTarget(Long ticketOrderId) {
        return ticketOrderRepository.findById(ticketOrderId)
                .filter(order -> order.getStatus() == TicketOrderStatus.CANCELED)
                .filter(TicketOrder::usesToken)
                .filter(order -> order.getRefundTx() == null)
                .map(order -> new RefundTarget(
                        order.getId(), order.getUser().getId(),
                        BigInteger.valueOf(order.getTokenAmount()), order.refundOperationKey()));
    }

    /** 카드 취소를 보낼 때 필요한 값 */
    @Transactional(readOnly = true)
    public Optional<CardCancelTarget> findCardCancelTarget(Long ticketOrderId) {
        return ticketOrderRepository.findById(ticketOrderId)
                .filter(order -> order.getStatus() == TicketOrderStatus.CANCELED)
                .filter(order -> order.getPayment() != null)
                .filter(order -> order.getPayment().cancelableAmount() > 0)
                .map(order -> new CardCancelTarget(
                        order.getId(),
                        order.getPayment().getPaymentKey(),
                        order.getPayment().cancelableAmount(),
                        cancelIdempotencyKey(order.getId())));
    }

    /**
     * 취소 멱등 키.
     *
     * <p><b>주문마다 고정이어야 한다.</b> 무작위로 만들면 재시도할 때마다 새 키가 되어 토스가
     * 같은 결제를 여러 번 취소한다. 주문 번호에서 결정론적으로 만든다.
     */
    static UUID cancelIdempotencyKey(Long ticketOrderId) {
        return UUID.nameUUIDFromBytes(("ticket-order-cancel:" + ticketOrderId).getBytes());
    }

    public record Invalidated(Long ticketOrderId, Long ticketId, int cashAmount, int tokenAmount) {
    }

    public record RefundTarget(Long ticketOrderId, Long userId, BigInteger amount, String operationKey) {
    }

    public record CardCancelTarget(Long ticketOrderId, String paymentKey, int amount, UUID idempotencyKey) {
    }
}
