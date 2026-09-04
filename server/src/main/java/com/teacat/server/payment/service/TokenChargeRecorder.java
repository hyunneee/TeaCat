package com.teacat.server.payment.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.payment.client.TossPaymentResult;
import com.teacat.server.payment.dto.response.TokenChargeResponse;
import com.teacat.server.payment.entity.Payment;
import com.teacat.server.payment.entity.PaymentPurpose;
import com.teacat.server.payment.entity.PaymentStatus;
import com.teacat.server.payment.entity.TokenCharge;
import com.teacat.server.payment.exception.PaymentErrorCode;
import com.teacat.server.payment.repository.PaymentRepository;
import com.teacat.server.payment.repository.TokenChargeRepository;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import com.teacat.server.wallet.entity.CatTransaction;
import com.teacat.server.wallet.repository.CatTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.util.Optional;
import java.util.UUID;

/**
 * 충전 흐름의 <b>DB 기록만</b> 담당합니다. 한 메서드가 곧 한 트랜잭션입니다.
 *
 * <p>{@link TokenChargeService} 와 나눠 놓은 이유는 하나입니다 — <b>외부 호출을 트랜잭션 안에서
 * 하지 않기 위해서</b>입니다. 토스 승인과 체인 발행은 각각 수십 초까지 걸릴 수 있고, 그동안 DB
 * 커넥션을 쥐고 있으면 풀이 마릅니다. 게다가 외부 호출이 성공한 뒤 커밋이 실패하면 "돈은 빠졌는데
 * 기록이 없는" 최악의 상태가 됩니다. 그래서 <b>짧게 커밋하고, 그 사이에 밖으로 나갑니다.</b>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TokenChargeRecorder {

    private final PaymentRepository paymentRepository;
    private final TokenChargeRepository tokenChargeRepository;
    private final CatTransactionRepository catTransactionRepository;
    private final UserRepository userRepository;

    /** 결제 준비. 주문번호와 금액이 여기서 확정된다 */
    @Transactional
    public Prepared prepare(Long userId, int amount) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));

        Payment payment = paymentRepository.save(
                Payment.ready(user, PaymentPurpose.TOKEN_CHARGE, amount));

        return new Prepared(payment.getOrderId(), amount, user.issuePaymentCustomerKey());
    }

    /**
     * 승인 요청 직전 선점.
     *
     * <p>행을 잠그고 {@code READY → IN_PROGRESS} 로 올린 뒤 <b>커밋합니다.</b> 그래야 같은 결제에
     * 두 번 승인이 나가지 않고, 승인 호출 중에 서버가 죽어도 복구 배치가 이 결제를 찾아냅니다.
     *
     * <p>리다이렉트로 돌아온 화면이 새로고침되는 일은 흔하므로, 이미 끝난 결제는 오류가 아니라
     * 같은 결과를 다시 돌려줍니다.
     */
    @Transactional
    public Claim claim(String orderId, Long userId, int requestedAmount) {
        Payment payment = paymentRepository.findWithLockByOrderId(orderId)
                .orElseThrow(() -> new BusinessException(PaymentErrorCode.PAYMENT_NOT_FOUND));

        if (!payment.isOwnedBy(userId)) {
            throw new BusinessException(PaymentErrorCode.PAYMENT_OWNER_MISMATCH);
        }
        // 티켓 결제를 충전 승인으로 통과시키면 결제 없이 캣머니가 발행된다
        if (payment.getPurpose() != PaymentPurpose.TOKEN_CHARGE) {
            throw new BusinessException(PaymentErrorCode.PAYMENT_NOT_FOUND);
        }
        // 프론트가 보낸 금액을 믿지 않는다. 다르면 위조 시도로 본다
        if (!payment.matchesAmount(requestedAmount)) {
            log.warn("결제 금액이 일치하지 않습니다. paymentId={} expected={} requested={}",
                    payment.getId(), payment.getAmount(), requestedAmount);
            throw new BusinessException(PaymentErrorCode.PAYMENT_AMOUNT_MISMATCH);
        }

        if (payment.isDone()) {
            TokenCharge charge = tokenChargeRepository.findByPaymentId(payment.getId())
                    .orElseThrow(() -> new BusinessException(PaymentErrorCode.TOKEN_CHARGE_NOT_FOUND));
            return new Claim(payment.getId(), payment.getAmount(), TokenChargeResponse.from(charge));
        }

        if (!payment.claimForApproval()) {
            // IN_PROGRESS(다른 요청이 승인 중) 이거나 이미 실패로 끝난 결제다
            throw new BusinessException(PaymentErrorCode.PAYMENT_ALREADY_PROCESSED);
        }

        return new Claim(payment.getId(), payment.getAmount(), null);
    }

    /**
     * 승인 결과 반영. 결제를 DONE 으로 올리고 충전 건을 만듭니다.
     *
     * <p>발행을 보내기 <b>전에</b> 커밋되는 것이 중요합니다. 그래야 그 사이에 죽어도
     * {@code mint_tx_id IS NULL} 로 남아 재발행 대상이 됩니다.
     *
     * @return 충전 ID
     */
    @Transactional
    public Long applyApproval(Long paymentId, TossPaymentResult result) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new BusinessException(PaymentErrorCode.PAYMENT_NOT_FOUND));

        // 토스가 확정한 금액이 우리가 만든 금액과 다르면 그대로 지급해선 안 된다.
        // 여기까지 왔다는 건 우리가 보낸 값이 그대로 돌아오지 않았다는 뜻이라 사람이 봐야 한다
        if (result.totalAmount() == null || !payment.matchesAmount(result.totalAmount())) {
            log.error("토스 승인 금액이 우리 기록과 다릅니다. paymentId={} ours={} toss={}",
                    paymentId, payment.getAmount(), result.totalAmount());
            throw new BusinessException(PaymentErrorCode.PAYMENT_AMOUNT_MISMATCH);
        }

        payment.approve(result.paymentKey(), result.method(), result.receiptUrl(), result.approvedAtLocal());

        // 재시도로 이미 만들어져 있을 수 있다 (uq_token_charges_payment 가 최종 방어선이다)
        TokenCharge charge = tokenChargeRepository.findByPaymentId(paymentId)
                .orElseGet(() -> tokenChargeRepository.save(
                        // 캣머니는 원화와 1:1 이다. 보너스가 붙으면 이 계산만 바뀐다
                        TokenCharge.of(payment, payment.getUser(), payment.getAmount())));

        return charge.getId();
    }

    /** 승인이 거절됐다. 사유를 남겨야 나중에 왜 실패했는지 알 수 있다 */
    @Transactional
    public void abort(Long paymentId, String failureCode, String failureMessage) {
        paymentRepository.findById(paymentId)
                .ifPresent(payment -> payment.abort(failureCode, failureMessage));
    }

    /** 발행을 보낼 때 필요한 값. 트랜잭션 밖에서 쓰므로 엔티티가 아니라 값으로 꺼낸다 */
    @Transactional(readOnly = true)
    public Optional<MintTarget> findMintTarget(Long chargeId) {
        return tokenChargeRepository.findById(chargeId)
                .filter(charge -> !charge.isMintSent())
                .map(charge -> new MintTarget(
                        charge.getId(),
                        charge.getUser().getId(),
                        charge.mintAmount(),
                        charge.operationKey()));
    }

    @Transactional
    public void attachMint(Long chargeId, Long catTransactionId) {
        TokenCharge charge = tokenChargeRepository.findById(chargeId).orElse(null);
        if (charge == null || charge.isMintSent()) {
            return;
        }

        CatTransaction mintTx = catTransactionRepository.findById(catTransactionId).orElse(null);
        if (mintTx != null) {
            charge.recordMint(mintTx);
        }
    }

    @Transactional(readOnly = true)
    public TokenChargeResponse getResponse(Long chargeId) {
        return tokenChargeRepository.findById(chargeId)
                .map(TokenChargeResponse::from)
                .orElseThrow(() -> new BusinessException(PaymentErrorCode.TOKEN_CHARGE_NOT_FOUND));
    }

    @Transactional(readOnly = true)
    public TokenChargeResponse getResponseForUser(Long chargeId, Long userId) {
        TokenCharge charge = tokenChargeRepository.findById(chargeId)
                .orElseThrow(() -> new BusinessException(PaymentErrorCode.TOKEN_CHARGE_NOT_FOUND));

        if (!charge.isOwnedBy(userId)) {
            throw new BusinessException(PaymentErrorCode.PAYMENT_OWNER_MISMATCH);
        }

        return TokenChargeResponse.from(charge);
    }

    /**
     * 승인 결과를 모른 채 남은 결제를 토스가 알려준 상태로 맞춥니다.
     *
     * @return 승인으로 확정됐으면 충전 ID (발행을 이어서 보내야 한다)
     */
    @Transactional
    public Optional<Long> reconcile(Long paymentId, TossPaymentResult result) {
        Payment payment = paymentRepository.findById(paymentId).orElse(null);
        if (payment == null || !payment.getStatus().isUnsettled()) {
            return Optional.empty();
        }

        if (result == null) {
            // 토스가 이 주문번호를 모른다 = 결제창까지 가지 않았다. 되살릴 것이 없다
            payment.abort("NOT_FOUND", "결제가 진행되지 않았습니다.");
            return Optional.empty();
        }

        if (!result.isDone()) {
            payment.abort(result.status(), "결제가 완료되지 않았습니다.");
            return Optional.empty();
        }

        log.warn("응답을 받지 못한 채 승인된 결제를 되살립니다. paymentId={}", paymentId);
        return Optional.of(applyApproval(paymentId, result));
    }

    public record Prepared(String orderId, int amount, UUID customerKey) {
    }

    /** {@code alreadyCharged} 가 있으면 이미 끝난 결제라 승인을 다시 보내지 않는다 */
    public record Claim(Long paymentId, int amount, TokenChargeResponse alreadyCharged) {
    }

    public record MintTarget(Long chargeId, Long userId, BigInteger amount, String operationKey) {
    }
}
