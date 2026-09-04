package com.teacat.server.payment.service;

import com.teacat.server.payment.client.TossPaymentResult;
import com.teacat.server.payment.client.TossPaymentsClient;
import com.teacat.server.payment.entity.Payment;
import com.teacat.server.payment.entity.PaymentStatus;
import com.teacat.server.payment.entity.TokenCharge;
import com.teacat.server.payment.repository.PaymentRepository;
import com.teacat.server.payment.repository.TokenChargeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Limit;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 충전이 중간에 멈춘 건을 되살립니다.
 *
 * <p>결제는 <b>실패하는 것보다 어중간하게 끝나는 것이 더 위험합니다.</b> 두 가지를 봅니다.
 *
 * <ol>
 *   <li><b>승인 결과를 모르는 결제</b> — 토스에 승인을 보내고 응답을 받기 전에 끊긴 경우입니다.
 *       사용자는 돈을 냈는데 우리는 모르는 상태라, 토스에 되물어 상태를 맞춥니다.
 *   <li><b>발행을 못 보낸 충전</b> — 승인은 끝났는데 체인 요청이 실패했거나 그 사이에 서버가
 *       죽은 경우입니다. 체인 멱등 키가 있어 다시 보내도 두 번 발행되지 않습니다.
 * </ol>
 *
 * <p>{@code CatTransactionScheduler} 와 마찬가지로 <b>인스턴스가 하나라는 전제</b>입니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TokenChargeScheduler {

    private static final Limit BATCH_SIZE = Limit.of(50);
    private static final List<PaymentStatus> UNSETTLED =
            List.of(PaymentStatus.READY, PaymentStatus.IN_PROGRESS);

    private final PaymentRepository paymentRepository;
    private final TokenChargeRepository tokenChargeRepository;
    private final TossPaymentsClient tossPaymentsClient;
    private final TokenChargeRecorder recorder;
    private final TokenChargeService tokenChargeService;

    /**
     * 결제창을 띄우고 사용자가 그대로 떠나는 일은 흔하므로, 갓 만들어진 결제까지 토스에 물으면
     * 대부분 헛걸음이다. 승인이 끝날 만한 시간이 지난 것만 본다.
     */
    @Value("${payment.recovery.settle-after}")
    private Duration settleAfter;

    @Scheduled(
            fixedDelayString = "${payment.recovery.interval}",
            initialDelayString = "${payment.recovery.initial-delay}")
    public void recoverUnsettledPayments() {
        List<Payment> unsettled = paymentRepository.findByStatusInAndCreatedAtBeforeOrderByIdAsc(
                UNSETTLED, LocalDateTime.now().minus(settleAfter), BATCH_SIZE);

        for (Payment payment : unsettled) {
            try {
                TossPaymentResult result = tossPaymentsClient.findByOrderId(payment.getOrderId())
                        .orElse(null);

                // 승인으로 확정됐다면 충전 건이 만들어졌으니 발행까지 이어서 보낸다
                Optional<Long> chargeId = recorder.reconcile(payment.getId(), result);
                chargeId.ifPresent(tokenChargeService::sendMint);
            } catch (RuntimeException e) {
                log.warn("결제 상태 복구에 실패했습니다. paymentId={}", payment.getId(), e);
            }
        }
    }

    @Scheduled(
            fixedDelayString = "${payment.recovery.interval}",
            initialDelayString = "${payment.recovery.initial-delay}")
    public void retryMissingMints() {
        List<TokenCharge> unminted = tokenChargeRepository.findByMintTxIsNullOrderByIdAsc(BATCH_SIZE);

        for (TokenCharge charge : unminted) {
            // sendMint 는 스스로 예외를 삼키고 로그를 남긴다
            tokenChargeService.sendMint(charge.getId());
        }
    }
}
