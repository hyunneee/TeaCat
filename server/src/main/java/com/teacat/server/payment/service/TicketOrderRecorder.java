package com.teacat.server.payment.service;

import com.teacat.server.booking.entity.PerformanceSeat;
import com.teacat.server.booking.entity.PerformanceSeatId;
import com.teacat.server.booking.exception.BookingErrorCode;
import com.teacat.server.booking.repository.PerformanceSeatRepository;
/* 2026-09-11: 카드팩 개봉 시각을 더 이상 여기서 계산하지 않는다(회차에서 매번 계산하도록
   NftPhotocardPackRepository 로 옮겼다). 이 클래스에서는 더 안 쓴다.
import com.teacat.server.common.config.BookingPolicyProperties;
*/
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.exception.ErrorCode;
import com.teacat.server.nft.entity.NftPhotocardPack;
import com.teacat.server.nft.repository.NftPhotocardPackRepository;
import com.teacat.server.payment.client.TossPaymentResult;
import com.teacat.server.payment.dto.response.TicketOrderResponse;
import com.teacat.server.payment.entity.Payment;
import com.teacat.server.payment.entity.TicketOrder;
import com.teacat.server.payment.exception.PaymentErrorCode;
import com.teacat.server.payment.repository.PaymentRepository;
import com.teacat.server.payment.repository.TicketOrderRepository;
import com.teacat.server.nft.repository.NftTicketRepository;
import com.teacat.server.ticket.entity.Ticket;
import com.teacat.server.ticket.repository.TicketRepository;
import com.teacat.server.user.entity.User;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import com.teacat.server.wallet.entity.CatTransaction;
import com.teacat.server.wallet.repository.CatTransactionRepository;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * 티켓 결제의 <b>DB 기록만</b> 담당합니다. 한 메서드가 곧 한 트랜잭션입니다.
 *
 * <p>{@link TicketOrderService} 와 나눈 이유는 충전 쪽과 같습니다 — 토스 승인과 체인 소각을
 * 트랜잭션 안에서 하지 않기 위해서입니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TicketOrderRecorder {

    /** 선점을 잃어 정리하는 주문의 사유. 토스가 준 코드가 아니라 우리가 붙이는 값이다 */
    private static final String HOLD_EXPIRED_CODE = "SEAT_HOLD_EXPIRED";
    private static final String HOLD_EXPIRED_MESSAGE = "좌석 선점이 만료되어 주문을 정리했습니다.";

    private final TicketOrderRepository ticketOrderRepository;
    private final PaymentRepository paymentRepository;
    private final PerformanceSeatRepository performanceSeatRepository;
    private final TicketRepository ticketRepository;
    private final CatTransactionRepository catTransactionRepository;
    private final NftTicketRepository nftTicketRepository;
    private final CatMoneyHoldService catMoneyHoldService;
    private final NftPhotocardPackRepository photocardPackRepository;
    /* 2026-09-11: 카드팩 개봉 시각을 더 이상 여기서 계산하지 않는다(회차에서 매번 계산하도록
       NftPhotocardPackRepository 로 옮겼다). 이 클래스에서는 더 안 쓴다.
    private final BookingPolicyProperties bookingPolicy;
    */

    /**
     * 승인 요청 직전 선점.
     *
     * <p>좌석을 <b>승인 전에</b> 다시 확인합니다. 선점이 만료돼 남이 가져간 좌석에 카드를 긁으면
     * 돈은 빠졌는데 좌석이 없는 상태가 됩니다. 승인 뒤에도 한 번 더 보지만(그 사이 만료될 수
     * 있으므로) 그때는 이미 늦으므로, 값싼 거절은 여기서 끝냅니다.
     */
    @Transactional
    public Claim claim(Long ticketOrderId, Long userId, boolean hasCardResult, Integer requestedAmount) {
        TicketOrder order = ticketOrderRepository.findWithLockById(ticketOrderId)
                .orElseThrow(() -> new BusinessException(PaymentErrorCode.TICKET_ORDER_NOT_FOUND));

        if (!order.isOwnedBy(userId)) {
            throw new BusinessException(PaymentErrorCode.PAYMENT_OWNER_MISMATCH);
        }

        // 결제 완료 화면 새로고침은 흔하다. 오류가 아니라 같은 결과를 돌려준다
        if (order.getStatus() == com.teacat.server.payment.entity.TicketOrderStatus.PAID) {
            return new Claim(order.getId(), null, 0, toResponse(order));
        }
        if (!order.isPending()) {
            throw new BusinessException(PaymentErrorCode.PAYMENT_ALREADY_PROCESSED);
        }

        requireMySeatStillHeld(order, userId);

        if (!order.requiresCardPayment()) {
            // 전액 캣머니. 토스를 부르지 않으므로 결제 키가 없는 게 정상이다
            return new Claim(order.getId(), null, 0, null);
        }

        if (!hasCardResult) {
            throw new BusinessException(PaymentErrorCode.PAYMENT_AMOUNT_MISMATCH);
        }
        // 프론트가 보낸 금액을 믿지 않는다
        if (!order.getCashAmount().equals(requestedAmount)) {
            log.warn("티켓 결제 금액이 일치하지 않습니다. ticketOrderId={} expected={} requested={}",
                    ticketOrderId, order.getCashAmount(), requestedAmount);
            throw new BusinessException(PaymentErrorCode.PAYMENT_AMOUNT_MISMATCH);
        }

        Payment payment = order.getPayment();
        if (!payment.claimForApproval()) {
            throw new BusinessException(PaymentErrorCode.PAYMENT_ALREADY_PROCESSED);
        }

        return new Claim(order.getId(), payment.getOrderId(), order.getCashAmount(), null);
    }

    /**
     * 승인 결과를 반영하고 <b>티켓을 발권</b>합니다.
     *
     * <p>좌석 확정은 조건부 UPDATE 한 번으로 합니다 — 조회 후 UPDATE 하면 그 사이에 선점이
     * 만료될 수 있습니다. 0건이면 이미 좌석을 잃은 것이고, 카드가 승인된 뒤라면 되돌릴 수
     * 없으므로 크게 남깁니다.
     *
     * @param result 카드 승인 결과. 전액 캣머니 결제면 null
     * @return 발권된 티켓 ID
     */
    @Transactional
    public Long applyApproval(Long ticketOrderId, TossPaymentResult result) {
        TicketOrder order = ticketOrderRepository.findById(ticketOrderId)
                .orElseThrow(() -> new BusinessException(PaymentErrorCode.TICKET_ORDER_NOT_FOUND));

        if (result != null) {
            Payment payment = order.getPayment();
            if (result.totalAmount() == null || !payment.matchesAmount(result.totalAmount())) {
                log.error("토스 승인 금액이 우리 기록과 다릅니다. ticketOrderId={} ours={} toss={}",
                        ticketOrderId, payment.getAmount(), result.totalAmount());
                throw new BusinessException(PaymentErrorCode.PAYMENT_AMOUNT_MISMATCH);
            }
            payment.approve(result.paymentKey(), result.method(), result.receiptUrl(),
                    result.approvedAtLocal());
        }

        // 재시도로 이미 발권돼 있을 수 있다
        if (order.getTicket() != null) {
            return order.getTicket().getId();
        }

        User user = order.getUser();
        Long seatId = order.getSeat() == null ? null : order.getSeat().getId();
        int sold = performanceSeatRepository.sell(
                order.getPerformanceDetail().getId(), seatId, user.getId());

        if (sold == 0) {
            // 카드가 이미 승인됐다면 돈은 빠졌는데 좌석이 없다. 자동 복구 경로가 아직 없다
            log.error("좌석 선점을 잃어 발권하지 못했습니다. 환불이 필요합니다. "
                            + "ticketOrderId={} detailId={} seatId={}",
                    ticketOrderId, order.getPerformanceDetail().getId(), seatId);
            throw new BusinessException(PaymentErrorCode.SEAT_NO_LONGER_HELD);
        }

        Ticket ticket = ticketRepository.save(Ticket.issue(
                user, order.getPerformanceDetail(), order.getArea(), order.getSeat(), user.getFace()));
        order.markPaid(ticket);

        // 카드팩 1개. 티켓 발권과 같은 트랜잭션이라 "결제는 됐는데 팩이 없다" 가 불가능하다.
        // 개봉 시각은 저장하지 않는다 — 그 회차의 공연 일시에서 매번 계산하므로
        // 공연을 연기해도 예매 취소 마감과 어긋나지 않는다.
        photocardPackRepository.save(NftPhotocardPack.grantForTicket(
                user.getId(), ticket.getId(), order.getPerformanceDetail().getId()));

        // 묶어둔 캣머니를 확정한다. 실제 소각은 트랜잭션 밖에서 뒤따라간다
        if (order.usesToken()) {
            catMoneyHoldService.capture(CatMoneyHoldRefType.TICKET_ORDER, order.getId());
        }

        log.info("티켓 발권 ticketOrderId={} ticketId={}", ticketOrderId, ticket.getId());
        return ticket.getId();
    }

    /**
     * 주문을 실패로 닫는다. 묶어둔 캣머니를 풀어주고 좌석 선점은 그대로 둔다(만료가 정리한다).
     *
     * <p>PENDING 일 때만 닫는다. 발권까지 끝난 주문을 실패로 되돌리면 안 된다.
     *
     * <p>변경을 바로 flush 한다. 부르는 쪽이 이어서 같은 좌석으로 새 주문을 INSERT 하는데,
     * Hibernate 는 INSERT 를 UPDATE 보다 먼저 내보내므로 그대로 두면 이 주문이 아직 PENDING 인
     * 채로 {@code uq_ticket_orders_pending_seat} 와 부딪힌다.
     */
    @Transactional
    public void abort(Long ticketOrderId, String failureCode, String failureMessage) {
        ticketOrderRepository.findById(ticketOrderId).ifPresent(order -> {
            if (!order.isPending()) {
                return;
            }
            if (order.getPayment() != null) {
                order.getPayment().abort(failureCode, failureMessage);
            }
            if (order.usesToken()) {
                catMoneyHoldService.release(CatMoneyHoldRefType.TICKET_ORDER, order.getId());
            }
            order.markFailed();
            ticketOrderRepository.flush();
        });
    }

    /**
     * 좌석 선점을 잃은 결제 대기 주문을 닫는다 (결제창을 닫고 돌아오지 않은 주문).
     *
     * <p>이 메서드에 {@code @Transactional} 을 다는 이유: 안에서 부르는 {@link #abort} 는 같은
     * 빈의 메서드라 프록시를 거치지 않는다. 여기가 트랜잭션 경계여야 배치에서 불러도 동작한다.
     */
    @Transactional
    public void expireStale(Long ticketOrderId) {
        abort(ticketOrderId, HOLD_EXPIRED_CODE, HOLD_EXPIRED_MESSAGE);
        log.info("선점을 잃은 결제 대기 주문을 정리했습니다. ticketOrderId={}", ticketOrderId);
    }

    /** 소각을 보낼 때 필요한 값. 트랜잭션 밖에서 쓰므로 엔티티가 아니라 값으로 꺼낸다 */
    @Transactional(readOnly = true)
    public Optional<BurnTarget> findBurnTarget(Long ticketOrderId) {
        return ticketOrderRepository.findById(ticketOrderId)
                .filter(TicketOrder::usesToken)
                .filter(order -> !order.isBurnSent())
                .map(order -> new BurnTarget(
                        order.getId(),
                        order.getUser().getId(),
                        order.burnAmount(),
                        order.burnOperationKey()));
    }

    @Transactional
    public void attachBurn(Long ticketOrderId, Long catTransactionId) {
        TicketOrder order = ticketOrderRepository.findById(ticketOrderId).orElse(null);
        if (order == null || order.isBurnSent()) {
            return;
        }

        CatTransaction burnTx = catTransactionRepository.findById(catTransactionId).orElse(null);
        if (burnTx != null) {
            order.recordBurn(burnTx);
        }
    }

    @Transactional(readOnly = true)
    public TicketOrderResponse getResponse(Long ticketOrderId) {
        return ticketOrderRepository.findById(ticketOrderId)
                .map(this::toResponse)
                .orElseThrow(() -> new BusinessException(PaymentErrorCode.TICKET_ORDER_NOT_FOUND));
    }

    /** 발행 상태는 nft_tickets 가 갖는다. 결제 직후에는 아직 그 행이 없을 수 있다 */
    private TicketOrderResponse toResponse(TicketOrder order) {
        return TicketOrderResponse.of(order, order.getTicket() == null ? null
                : nftTicketRepository.findByTicketId(order.getTicket().getId()).orElse(null));
    }

    @Transactional(readOnly = true)
    public TicketOrderResponse getResponseForUser(Long ticketOrderId, Long userId) {
        TicketOrder order = ticketOrderRepository.findById(ticketOrderId)
                .orElseThrow(() -> new BusinessException(PaymentErrorCode.TICKET_ORDER_NOT_FOUND));

        if (!order.isOwnedBy(userId)) {
            throw new BusinessException(PaymentErrorCode.PAYMENT_OWNER_MISMATCH);
        }
        return toResponse(order);
    }

    /**
     * 선점이 아직 내 것인지. 승인을 보내기 전에 값싸게 거른다.
     *
     * <p>switch <b>식</b>이라 상태를 하나라도 빠뜨리면 컴파일이 되지 않는다. 문으로 두면 빠진
     * 상태가 조용히 통과해 <b>카드를 긁은 뒤에</b> 발권에서 막힌다 — 가장 비싼 실패다.
     */
    private void requireMySeatStillHeld(TicketOrder order, Long userId) {
        Long seatId = order.getSeat() == null ? null : order.getSeat().getId();
        PerformanceSeat seat = performanceSeatRepository
                .findById(new PerformanceSeatId(order.getPerformanceDetail().getId(), seatId))
                .orElseThrow(() -> new BusinessException(BookingErrorCode.SEAT_NOT_FOUND));

        ErrorCode failure = switch (seat.getStatus()) {
            // 판매에서 빠진 좌석(BLOCKED)에는 발권할 수 없다
            case SOLD, BLOCKED -> BookingErrorCode.SEAT_ALREADY_SOLD;
            case AVAILABLE -> PaymentErrorCode.SEAT_NO_LONGER_HELD;
            case HELD -> heldFailure(seat, userId);
        };

        if (failure != null) {
            throw new BusinessException(failure);
        }
    }

    /** 선점된 좌석이 지금 내 것이고 아직 살아 있는지. 문제없으면 null */
    private ErrorCode heldFailure(PerformanceSeat seat, Long userId) {
        if (!userId.equals(seat.getHeldBy())) {
            return BookingErrorCode.NOT_SEAT_HOLDER;
        }
        if (seat.isHeldExpired(LocalDateTime.now())) {
            return BookingErrorCode.SEAT_HOLD_EXPIRED;
        }
        return null;
    }

    /** {@code alreadyPaid} 가 있으면 이미 끝난 주문이라 승인을 다시 보내지 않는다 */
    public record Claim(Long ticketOrderId, String orderId, int cashAmount,
                        TicketOrderResponse alreadyPaid) {

        public boolean requiresCardApproval() {
            return orderId != null;
        }
    }

    public record BurnTarget(Long ticketOrderId, Long userId, BigInteger amount, String operationKey) {
    }
}
