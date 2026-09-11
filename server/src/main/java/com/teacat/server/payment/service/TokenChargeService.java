package com.teacat.server.payment.service;

import com.teacat.server.common.config.TokenChargePolicyProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.payment.client.TossPaymentException;
import com.teacat.server.payment.client.TossPaymentResult;
import com.teacat.server.payment.client.TossPaymentsClient;
import com.teacat.server.payment.dto.request.TokenChargeConfirmRequest;
import com.teacat.server.payment.dto.response.TokenChargePrepareResponse;
import com.teacat.server.payment.dto.response.TokenChargeResponse;
import com.teacat.server.payment.exception.PaymentErrorCode;
import com.teacat.server.wallet.entity.CatTransaction;
import com.teacat.server.wallet.entity.CatTxReason;
import com.teacat.server.wallet.service.CatMoneyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.text.NumberFormat;
import java.util.Locale;
import java.util.Optional;

/**
 * 캣머니 충전.
 *
 * <pre>
 *   준비   payments(READY) 생성 — 주문번호·금액을 서버가 확정
 *   승인   IN_PROGRESS 선점 → 토스 승인 → DONE + token_charges 생성
 *   발행   캣머니 mint(DEPOSIT) 요청 → cat_transactions(PENDING)
 *   확정   폴링이 체인에서 확인 → CONFIRMED (잔액에 반영)
 * </pre>
 *
 * <p><b>이 클래스에는 트랜잭션이 없습니다.</b> 각 단계의 커밋은 {@link TokenChargeRecorder} 가
 * 짧게 처리하고, 외부 호출(토스·체인)은 트랜잭션 밖에서 일어납니다. 이유는 그쪽 문서에 있습니다.
 *
 * <p><b>발행 실패는 결제 실패가 아닙니다.</b> 승인이 끝난 시점에 사용자는 이미 돈을 냈습니다.
 * 여기서 예외를 던져 400 을 주면 사용자는 "실패했다" 고 믿고 다시 결제합니다. 그래서 발행이
 * 실패해도 성공 응답을 주되 상태를 {@code MINTING} 으로 내리고 재시도에 맡깁니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TokenChargeService {

    private final TokenChargeRecorder recorder;
    private final TossPaymentsClient tossPaymentsClient;
    private final CatMoneyService catMoneyService;
    private final TokenChargePolicyProperties policy;

    /** 결제창을 띄우기 전에 주문번호와 금액을 확정합니다 */
    public TokenChargePrepareResponse prepare(Long userId, int amount) {
        if (amount < policy.minAmount() || amount > policy.maxAmount()) {
            throw new BusinessException(PaymentErrorCode.PAYMENT_AMOUNT_OUT_OF_RANGE);
        }

        TokenChargeRecorder.Prepared prepared = recorder.prepare(userId, amount);

        return new TokenChargePrepareResponse(
                prepared.orderId(),
                orderName(amount),
                prepared.amount(),
                prepared.customerKey());
    }

    /** 결제창에서 성공으로 돌아온 뒤 승인하고 캣머니를 발행합니다 */
    public TokenChargeResponse confirm(Long userId, TokenChargeConfirmRequest request) {
        TokenChargeRecorder.Claim claim = recorder.claim(request.orderId(), userId, request.amount());

        // 새로고침 등으로 다시 들어온 요청. 승인을 또 보내지 않고 같은 결과를 돌려준다
        if (claim.alreadyCharged() != null) {
            return claim.alreadyCharged();
        }

        TossPaymentResult result;
        try {
            // 주문번호를 멱등 키로 쓴다. 같은 결제가 두 번 승인되지 않는다
            result = tossPaymentsClient.confirm(
                    request.paymentKey(), request.orderId(), claim.amount(), request.orderId());
        } catch (TossPaymentException e) {
            recorder.abort(claim.paymentId(), e.getCode(), e.getMessage());
            throw new BusinessException(PaymentErrorCode.PAYMENT_APPROVAL_FAILED);
        }

        Long chargeId = recorder.applyApproval(claim.paymentId(), result);
        sendMint(chargeId);

        return recorder.getResponse(chargeId);
    }

    public TokenChargeResponse getCharge(Long userId, Long chargeId) {
        return recorder.getResponseForUser(chargeId, userId);
    }

    /**
     * 캣머니 발행을 보냅니다. 이미 보냈으면 아무것도 하지 않습니다.
     *
     * <p>실패해도 예외를 밖으로 내보내지 않습니다 — 결제는 이미 끝났고, 체인 멱등 키가 있어
     * 재시도가 안전하기 때문입니다. 재시도 배치가 같은 메서드를 부릅니다.
     */
    public void sendMint(Long chargeId) {
        Optional<TokenChargeRecorder.MintTarget> target = recorder.findMintTarget(chargeId);
        if (target.isEmpty()) {
            return;
        }

        try {
            CatTransaction mintTx = catMoneyService.mint(
                    target.get().userId(),
                    target.get().amount(),
                    CatTxReason.DEPOSIT,
                    target.get().operationKey());

            recorder.attachMint(chargeId, mintTx.getId());
        } catch (RuntimeException e) {
            log.error("캣머니 발행을 보내지 못했습니다. 재시도 대상입니다. chargeId={}", chargeId, e);
        }
    }

    /** 결제창에 뜨는 이름. 금액 표기는 사용자가 결제창에서 보는 값과 같아야 헷갈리지 않는다 */
    private String orderName(int amount) {
        return "캣머니 " + NumberFormat.getIntegerInstance(Locale.KOREA).format(amount) + " 충전";
    }
}
