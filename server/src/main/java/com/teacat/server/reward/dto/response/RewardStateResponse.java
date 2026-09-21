package com.teacat.server.reward.dto.response;

import com.teacat.server.reward.entity.DailyReward;
import com.teacat.server.reward.entity.RewardType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 보상 한 종류의 오늘 상태.
 *
 * <p>{@code amount} 를 늘 같이 내려준다. 화면이 "500 캣머니" 를 자기 파일에 적어 두면 금액을
 * 바꿀 때 서버·프론트 두 곳을 고쳐야 하고, 배포 순서에 따라 화면이 거짓말을 한다.
 */
@Schema(description = "보상 한 종류의 오늘 상태")
public record RewardStateResponse(

        @Schema(description = "보상 종류", example = "ATTENDANCE")
        RewardType type,

        @Schema(description = "받으면 지급되는 금액(캣머니)", example = "500")
        long amount,

        @Schema(description = "오늘 이미 받았는가", example = "false")
        boolean claimed,

        @Schema(description = "받은 시각. 아직 안 받았으면 없다")
        LocalDateTime claimedAt
) {

    public static RewardStateResponse of(RewardType type, DailyReward claimed) {
        return new RewardStateResponse(
                type,
                type.amount(),
                claimed != null,
                claimed == null ? null : claimed.getCreatedAt());
    }
}
