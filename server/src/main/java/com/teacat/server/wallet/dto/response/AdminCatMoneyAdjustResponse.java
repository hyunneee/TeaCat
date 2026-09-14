package com.teacat.server.wallet.dto.response;

import com.teacat.server.wallet.entity.CatTransaction;
import com.teacat.server.wallet.entity.CatTxReason;
import com.teacat.server.wallet.entity.CatTxStatus;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 관리자 캣머니 조정 결과.
 *
 * <p>🔴 <b>이 응답이 왔다고 잔액이 바뀐 게 아니다.</b> 체인에 보냈을 뿐이고 확정까지 블록
 * 하나(약 10초)가 걸린다({@code status = PENDING}). 화면은 "반영 중" 으로 말해야 한다 —
 * 바로 잔액을 다시 부르면 옛 값이 와서 "안 먹혔다" 로 보인다.
 *
 * <p>{@code requestedAmount} 와 {@code appliedAmount} 가 다를 수 있다. 소각은 가용 잔액보다
 * 많이 뺄 수 없어 가용 잔액만큼만 깎기 때문이다 (999999 를 넣어 "0 으로 만들기" 를 쓰라고
 * 둔 동작이다). 넣기(grant)는 항상 같다.
 */
@Schema(description = "관리자용 캣머니 조정 결과")
public record AdminCatMoneyAdjustResponse(

        @Schema(description = "조정 대상 회원 ID", example = "42")
        Long userId,

        @Schema(description = "원장에 남은 사유", example = "ADMIN_GRANT")
        CatTxReason reason,

        @Schema(description = "요청한 금액", example = "50000")
        long requestedAmount,

        @Schema(description = "실제로 반영한 금액. 소각은 가용 잔액을 넘지 못해 줄어들 수 있다",
                example = "30000")
        long appliedAmount,

        @Schema(description = "체인 반영 상태. PENDING 이면 아직 확정 전이다(약 10초)",
                example = "PENDING")
        CatTxStatus status,

        @Schema(description = "트랜잭션 해시. 이미 처리된 작업(ALREADY_DONE)이면 없다",
                example = "0x9f2c...")
        String txHash
) {

    /*
     * userId 를 따로 받는다. transaction.getUser() 는 지연 로딩이고 이 호출은 트랜잭션
     * 밖에서 일어나므로(발행·소각이 NOT_SUPPORTED 다), 프록시가 걸리면 터진다.
     */
    public static AdminCatMoneyAdjustResponse of(Long userId, CatTransaction transaction,
            long requestedAmount) {
        return new AdminCatMoneyAdjustResponse(
                userId,
                transaction.getReason(),
                requestedAmount,
                transaction.getAmount().longValueExact(),
                transaction.getStatus(),
                transaction.getTxHash());
    }
}
