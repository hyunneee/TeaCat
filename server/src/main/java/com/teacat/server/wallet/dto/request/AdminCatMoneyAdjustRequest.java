package com.teacat.server.wallet.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * 관리자가 특정 회원의 캣머니를 넣거나 뺀다 (테스트용).
 *
 * <p>금액만 받는다. 넣을지 뺄지는 경로(.../grant, .../burn)가 정한다 — 부호로 방향을
 * 주면 -1000 을 1000 으로 잘못 읽는 실수가 조용히 돈을 넣어버린다.
 */
@Schema(description = "관리자용 캣머니 조정 요청")
public record AdminCatMoneyAdjustRequest(

        /*
         * 상한을 두는 이유는 오타다. 0 을 몇 개 더 붙여도 체인은 그대로 발행하고,
         * 발행한 캣머니는 되돌리려면 다시 소각을 보내야 한다(10초씩 두 번).
         * 1억이면 테스트에 모자랄 일이 없고 실수는 걸러진다.
         */
        @Schema(description = "조정할 금액 (1 이상 1억 이하). 캣머니는 소수가 없어 정수다", example = "10000")
        @NotNull(message = "금액을 입력해 주세요.")
        @Positive(message = "금액은 1 이상이어야 합니다.")
        @Max(value = 100_000_000L, message = "한 번에 조정할 수 있는 금액은 1억까지입니다.")
        Long amount
) {
}
