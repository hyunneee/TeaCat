package com.teacat.server.payment.service;

import com.teacat.server.payment.client.TossPaymentException;
import com.teacat.server.payment.client.TossPaymentResult;
import com.teacat.server.payment.client.TossPaymentsClient;
import com.teacat.server.payment.dto.response.TicketOrderResponse;
import com.teacat.server.ticket.service.TicketBurnService;
import com.teacat.server.wallet.entity.CatTransaction;
import com.teacat.server.wallet.entity.CatTxReason;
import com.teacat.server.wallet.service.CatMoneyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * 예매 취소와 환불.
 *
 * <pre>
 *   무효화   티켓 CANCELLED + 주문 CANCELED + 좌석 AVAILABLE   ← 먼저 커밋
 *   카드취소  토스 cancel + payment_cancels 기록
 *   환급     캣머니 mint(REFUND)
 *   소각     NFT SBT burn
 * </pre>
 *
 * <p><b>결제와 순서가 반대입니다.</b> 결제는 돈을 먼저 받고 티켓을 줬지만, 취소는 티켓을 먼저
 * 무효화하고 돈을 돌려줍니다. 환불이 실패했을 때 "티켓도 못 쓰고 돈도 못 받은" 상태는 재시도로
 * 갚을 수 있지만, "티켓은 살아 있는데 환불은 끝난" 상태는 되돌릴 방법이 없습니다.
 *
 * <p>뒤따르는 세 가지는 <b>실패해도 예외를 밖으로 내보내지 않습니다.</b> 취소 자체는 이미
 * 확정됐고, 사용자에게 "취소 실패" 를 보여주면 다시 누르게 됩니다. 전부 멱등이라 배치가
 * 재시도합니다 — 다만 <b>환불은 반드시 끝나야 하는 빚</b>이라 로그를 크게 남깁니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TicketCancelService {

    private static final String CANCEL_REASON = "구매자 예매 취소";

    private final TicketCancelRecorder recorder;
    private final TicketOrderRecorder orderRecorder;
    private final TossPaymentsClient tossPaymentsClient;
    private final CatMoneyService catMoneyService;
    private final TicketBurnService ticketBurnService;

    /** 예매를 취소하고 환불을 시작한다 */
    public TicketOrderResponse cancel(Long userId, Long ticketOrderId) {
        TicketCancelRecorder.Invalidated invalidated =
                recorder.invalidate(ticketOrderId, userId, LocalDateTime.now());

        // 여기부터는 실패해도 취소를 되돌리지 않는다. 배치가 이어받는다
        cancelCard(ticketOrderId);
        refundToken(ticketOrderId);
        ticketBurnService.requestBurn(invalidated.ticketId());

        return orderRecorder.getResponse(ticketOrderId);
    }

    /**
     * 카드 취소를 보낸다. 돌려줄 금액이 없으면 아무것도 하지 않는다.
     *
     * <p>멱등 키가 주문마다 고정이라 재시도해도 두 번 취소되지 않는다.
     */
    public void cancelCard(Long ticketOrderId) {
        Optional<TicketCancelRecorder.CardCancelTarget> target =
                recorder.findCardCancelTarget(ticketOrderId);
        if (target.isEmpty()) {
            return;
        }

        TicketCancelRecorder.CardCancelTarget card = target.get();
        try {
            TossPaymentResult result = tossPaymentsClient.cancel(
                    card.paymentKey(), CANCEL_REASON, card.amount(),
                    card.idempotencyKey().toString());

            recorder.recordCardCancel(ticketOrderId, card.amount(), CANCEL_REASON,
                    card.idempotencyKey(), result.paymentKey());

            log.info("카드 취소 완료 ticketOrderId={} amount={}", ticketOrderId, card.amount());
        } catch (TossPaymentException e) {
            // 돌려줘야 할 돈이 남았다. 배치가 다시 시도한다
            log.error("카드 취소에 실패했습니다. 환불이 남아 있습니다. ticketOrderId={} amount={} code={}",
                    ticketOrderId, card.amount(), e.getCode());
        } catch (RuntimeException e) {
            log.error("카드 취소에 실패했습니다. 환불이 남아 있습니다. ticketOrderId={} amount={}",
                    ticketOrderId, card.amount(), e);
        }
    }

    /** 캣머니를 환급한다. 소각이 아니라 <b>발행</b>이다 — 캣머니는 트레저리를 두지 않는다 */
    public void refundToken(Long ticketOrderId) {
        Optional<TicketCancelRecorder.RefundTarget> target = recorder.findRefundTarget(ticketOrderId);
        if (target.isEmpty()) {
            return;
        }

        try {
            CatTransaction refundTx = catMoneyService.mint(
                    target.get().userId(), target.get().amount(),
                    CatTxReason.REFUND, target.get().operationKey());

            recorder.attachRefund(ticketOrderId, refundTx.getId());
            log.info("캣머니 환급 ticketOrderId={} amount={}", ticketOrderId, target.get().amount());
        } catch (RuntimeException e) {
            log.error("캣머니 환급에 실패했습니다. 환불이 남아 있습니다. ticketOrderId={} amount={}",
                    ticketOrderId, target.get().amount(), e);
        }
    }
}
