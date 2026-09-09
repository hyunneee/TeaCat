package com.teacat.server.payment.service;

import com.teacat.server.booking.entity.PerformanceSeat;
import com.teacat.server.booking.entity.PerformanceSeatId;
import com.teacat.server.booking.exception.BookingErrorCode;
import com.teacat.server.booking.repository.PerformanceSeatRepository;
import com.teacat.server.common.config.BookingPolicyProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.payment.client.TossPaymentException;
import com.teacat.server.payment.client.TossPaymentResult;
import com.teacat.server.payment.client.TossPaymentsClient;
import com.teacat.server.payment.dto.request.TicketOrderConfirmRequest;
import com.teacat.server.payment.dto.response.TicketOrderPrepareResponse;
import com.teacat.server.payment.dto.response.TicketOrderResponse;
import com.teacat.server.payment.entity.Payment;
import com.teacat.server.payment.entity.PaymentPurpose;
import com.teacat.server.payment.entity.TicketOrder;
import com.teacat.server.payment.exception.PaymentErrorCode;
import com.teacat.server.payment.repository.PaymentRepository;
import com.teacat.server.payment.repository.TicketOrderRepository;
import com.teacat.server.performance.entity.PerformanceArea;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.performance.repository.PerformanceAreaRepository;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.stadium.entity.Seat;
import com.teacat.server.stadium.repository.SeatRepository;
import com.teacat.server.ticket.entity.TicketStatus;
import com.teacat.server.ticket.repository.TicketRepository;
import com.teacat.server.ticket.service.TicketIssueService;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import com.teacat.server.wallet.entity.CatTransaction;
import com.teacat.server.wallet.entity.CatTxReason;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import com.teacat.server.wallet.service.CatMoneyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 티켓 주문 생성.
 *
 * <p><b>금액 분해가 여기서 확정됩니다.</b> 캣머니 사용분은 프론트가 정하지 않습니다 — 그러면
 * "내 잔액이 5만원" 이라고 주장해 카드 결제액을 줄일 수 있습니다. 서버가 가용 잔액을 직접 읽어
 * 티켓 값 한도 안에서 최대한 채우고, 남은 금액만 카드로 받습니다.
 *
 * <p>캣머니 사용분은 곧바로 <b>홀드</b>로 묶습니다. 결제창을 띄워둔 채로 같은 돈을 경매 입찰에
 * 또 쓰는 것을 막기 위해서입니다 — 경매와 같은 원장을 씁니다 ({@link CatMoneyHoldService}).
 *
 * <p>주의: 가용 잔액 조회가 체인 HTTP 를 타므로 이 트랜잭션은 그 왕복만큼 길어집니다.
 * 홀드가 {@code MANDATORY} 라 트랜잭션 밖으로 뺄 수 없고, 경매도 같은 구조입니다.
 * 유저 단위 락으로 직렬화되므로 한 사람의 지연이 다른 사람에게 번지지는 않습니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TicketOrderService {

    private final PerformanceSeatRepository performanceSeatRepository;
    private final PerformanceDetailRepository performanceDetailRepository;
    private final PerformanceAreaRepository performanceAreaRepository;
    private final SeatRepository seatRepository;
    private final TicketRepository ticketRepository;
    private final TicketOrderRepository ticketOrderRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;
    private final CatMoneyHoldService catMoneyHoldService;
    private final CatMoneyService catMoneyService;
    private final TicketOrderRecorder recorder;
    private final TicketIssueService ticketIssueService;
    private final TossPaymentsClient tossPaymentsClient;
    private final BookingPolicyProperties bookingPolicy;

    /**
     * 선점해 둔 좌석으로 주문을 연다.
     *
     * @return 카드로 낼 금액이 0원이면 {@code orderId} 없이 내려간다 (결제창을 띄우지 않는다)
     */
    @Transactional
    public TicketOrderPrepareResponse open(Long userId, Long performanceDetailId, Long seatId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));

        // 선점 때도 봤지만 다시 본다. 그 사이에 얼굴을 지웠을 수 있고(API-110),
        // 얼굴 없이는 티켓 행을 만들 수 없어 결제를 받고 나서 막히면 되돌리기가 가장 비싸다
        if (!user.hasFace()) {
            throw new BusinessException(BookingErrorCode.FACE_NOT_REGISTERED);
        }

        requireMyValidHold(performanceDetailId, seatId, userId);
        PerformanceDetail detail = performanceDetailRepository.findById(performanceDetailId)
                .orElseThrow(() -> new BusinessException(BookingErrorCode.PERFORMANCE_DETAIL_NOT_FOUND));
        Seat seatRow = seatRepository.findById(seatId)
                .orElseThrow(() -> new BusinessException(BookingErrorCode.SEAT_NOT_FOUND));

        requireWithinTicketLimit(userId, performanceDetailId);

        int totalAmount = resolvePrice(detail, seatRow);
        // 가용 잔액 = 체인 잔액 − 유효 홀드 − 미확정 소각. 티켓 값을 넘지 않는 선에서 최대한 쓴다
        int tokenAmount = (int) Math.max(0, Math.min(catMoneyHoldService.availableBalance(userId), totalAmount));
        int cashAmount = totalAmount - tokenAmount;

        // 토스는 0원 결제를 받지 않는다. 캣머니가 전액을 덮으면 payments 행 자체를 만들지 않는다
        Payment payment = cashAmount > 0
                ? paymentRepository.save(Payment.ready(user, PaymentPurpose.TICKET, cashAmount))
                : null;

        TicketOrder order = ticketOrderRepository.save(TicketOrder.open(
                user, detail, seatRow.getArea(), seatRow, totalAmount, tokenAmount, payment));

        if (tokenAmount > 0) {
            // 같은 트랜잭션에서 묶는다. 따로 커밋되면 "주문은 없는데 돈만 묶인" 상태가 남는다
            catMoneyHoldService.hold(userId, tokenAmount, CatMoneyHoldRefType.TICKET_ORDER, order.getId());
        }

        log.info("티켓 주문 생성 orderId={} total={} token={} cash={}",
                order.getId(), totalAmount, tokenAmount, cashAmount);

        return TicketOrderPrepareResponse.of(order, orderName(detail, seatRow), user.issuePaymentCustomerKey());
    }

    /**
     * 결제를 승인하고 티켓을 발권한다.
     *
     * <p><b>카드 승인 → 발권 → 소각</b> 순서다. 소각을 먼저 하면 카드가 거절됐을 때 태운 캣머니를
     * 되돌려야 하고, 그 사이 사용자 자산이 사라진 구간이 생긴다. 반대로 소각이 실패해도 사용자는
     * 티켓을 받고, 못 태운 캣머니는 멱등 키로 재시도하면 된다.
     *
     * <p>소각 확정(블록 10초)은 기다리지 않는다. 기다리면 결제 API 가 그만큼 붙잡힌다 —
     * 대신 미확정 소각이 가용액에서 빠지므로 이중 사용은 막힌다.
     */
    public TicketOrderResponse confirm(Long userId, TicketOrderConfirmRequest request) {
        TicketOrderRecorder.Claim claim = recorder.claim(
                request.ticketOrderId(), userId, request.hasCardResult(), request.amount());

        // 새로고침 등으로 다시 들어온 요청. 승인을 또 보내지 않고 같은 결과를 돌려준다
        if (claim.alreadyPaid() != null) {
            return claim.alreadyPaid();
        }

        TossPaymentResult result = null;
        if (claim.requiresCardApproval()) {
            try {
                // 주문번호를 멱등 키로 쓴다. 같은 결제가 두 번 승인되지 않는다
                result = tossPaymentsClient.confirm(
                        request.paymentKey(), claim.orderId(), claim.cashAmount(), claim.orderId());
            } catch (TossPaymentException e) {
                recorder.abort(claim.ticketOrderId(), e.getCode(), e.getMessage());
                throw new BusinessException(PaymentErrorCode.PAYMENT_APPROVAL_FAILED);
            }
        }

        Long ticketId = recorder.applyApproval(claim.ticketOrderId(), result);

        // 둘 다 실패해도 예매는 유효하다. 사용자를 기다리게 하지 않고 재시도에 맡긴다
        sendBurn(claim.ticketOrderId());
        ticketIssueService.requestIssue(ticketId);

        return recorder.getResponse(claim.ticketOrderId());
    }

    public TicketOrderResponse getOrder(Long userId, Long ticketOrderId) {
        return recorder.getResponseForUser(ticketOrderId, userId);
    }

    /**
     * 캣머니 소각을 보낸다. 이미 보냈으면 아무것도 하지 않는다.
     *
     * <p>실패해도 예외를 밖으로 내보내지 않는다 — 결제와 발권은 이미 끝났고, 체인 멱등 키가 있어
     * 재시도가 안전하다. 여기서 실패를 던지면 사용자는 티켓을 받고도 실패 화면을 본다.
     */
    public void sendBurn(Long ticketOrderId) {
        var target = recorder.findBurnTarget(ticketOrderId);
        if (target.isEmpty()) {
            return;
        }

        try {
            CatTransaction burnTx = catMoneyService.burn(
                    target.get().userId(), target.get().amount(),
                    CatTxReason.PAYMENT, target.get().operationKey());

            recorder.attachBurn(ticketOrderId, burnTx.getId());
        } catch (RuntimeException e) {
            log.error("캣머니 소각을 보내지 못했습니다. 재시도 대상입니다. ticketOrderId={}", ticketOrderId, e);
        }
    }

    /**
     * 내가 유효하게 선점 중인 좌석인지 확인한다.
     *
     * <p>선점이 없거나 만료됐으면 결제를 시작할 수 없다 — 그 좌석은 이미 남이 가져갈 수 있는
     * 상태다. 실패 사유는 선점 API 와 같은 코드로 내려 프론트가 같은 분기를 쓰게 한다.
     */
    private void requireMyValidHold(Long performanceDetailId, Long seatId, Long userId) {
        PerformanceSeat seat = performanceSeatRepository
                .findById(new PerformanceSeatId(performanceDetailId, seatId))
                .orElseThrow(() -> new BusinessException(BookingErrorCode.SEAT_NOT_FOUND));

        switch (seat.getStatus()) {
            case SOLD -> throw new BusinessException(BookingErrorCode.SEAT_ALREADY_SOLD);
            case AVAILABLE -> throw new BusinessException(BookingErrorCode.SEAT_HOLD_NOT_FOUND);
            case HELD -> {
                if (!userId.equals(seat.getHeldBy())) {
                    throw new BusinessException(BookingErrorCode.NOT_SEAT_HOLDER);
                }
                if (seat.isHeldExpired(LocalDateTime.now())) {
                    throw new BusinessException(BookingErrorCode.SEAT_HOLD_EXPIRED);
                }
            }
        }
    }

    /** 1인 최대 매수 (booking.policy.max-tickets-per-user). 취소된 티켓은 세지 않는다 */
    private void requireWithinTicketLimit(Long userId, Long performanceDetailId) {
        long owned = ticketRepository.countByUserIdAndPerformanceDetailIdAndStatus(
                userId, performanceDetailId, TicketStatus.CONFIRMED);

        if (owned >= bookingPolicy.maxTicketsPerUser()) {
            throw new BusinessException(PaymentErrorCode.TICKET_LIMIT_EXCEEDED);
        }
    }

    /**
     * 좌석 가격. 공연(회차가 아니라 공연 단위)과 구역의 조합으로 정해진다.
     *
     * <p>주문 시점의 값을 {@code ticket_orders.total_amount} 에 복사해 둔다. 가격이 나중에
     * 바뀌어도 이 주문이 얼마짜리였는지는 남아야 한다.
     */
    private int resolvePrice(PerformanceDetail detail, Seat seat) {
        PerformanceArea performanceArea = performanceAreaRepository
                .findById(new PerformanceArea.PerformanceAreaId(
                        detail.getPerformance().getId(), seat.getArea().getId()))
                .orElseThrow(() -> new BusinessException(PaymentErrorCode.AREA_PRICE_NOT_SET));

        Integer price = performanceArea.getPrice();
        if (price == null || price <= 0) {
            throw new BusinessException(PaymentErrorCode.AREA_PRICE_NOT_SET);
        }
        return price;
    }

    /** 결제창과 내역에 보일 이름 */
    private String orderName(PerformanceDetail detail, Seat seat) {
        return "%s %d회차 %s구역 %s열 %d번".formatted(
                detail.getPerformance().getTitle(),
                detail.getPerformanceNum(),
                seat.getArea().getAreaCode(),
                seat.getRowLabel(),
                seat.getSeatNumber());
    }
}
