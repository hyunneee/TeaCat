package com.teacat.server.reward.dto.response;

import com.teacat.server.reward.entity.RewardType;
import com.teacat.server.wallet.entity.CatTransaction;
import com.teacat.server.wallet.entity.CatTxStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

/**
 * 보상 지급 요청 결과.
 *
 * <p>🔴 <b>이 응답이 왔다고 잔액이 이미 늘어난 것은 아니다.</b> 체인에 발행을 보냈을 뿐이고
 * 확정까지 블록 하나(약 10초)가 걸린다({@code status = PENDING}). 화면은 곧바로 잔액을 다시
 * 부르지 말고 "반영 중" 으로 말해야 한다 — 바로 부르면 옛 값이 와서 "안 들어왔다" 로 보인다.
 * ({@code AdminCatMoneyAdjustResponse} 와 같은 이유)
 */
@Schema(description = "캣머니 보상 지급 결과")
public record RewardClaimResponse(

        @Schema(description = "받은 보상 종류", example = "ATTENDANCE")
        RewardType type,

        @Schema(description = "지급한 금액(캣머니)", example = "500")
        long amount,

        @Schema(description = "받은 날짜 (Asia/Seoul)", example = "2026-09-21")
        LocalDate date,

        @Schema(description = "체인 반영 상태. PENDING 이면 아직 확정 전이다(약 10초)",
                example = "PENDING")
        CatTxStatus status
) {

    public static RewardClaimResponse of(RewardType type, LocalDate date, CatTransaction transaction) {
        return new RewardClaimResponse(type, type.amount(), date, transaction.getStatus());
    }
}
