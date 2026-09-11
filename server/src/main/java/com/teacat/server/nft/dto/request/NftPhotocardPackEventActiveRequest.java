package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "카드팩 이벤트 열기/닫기 요청")
public record NftPhotocardPackEventActiveRequest(

        @Schema(description = "켜면 지급 대상이 된다. 기간 조건은 그대로 적용된다", example = "false")
        @NotNull(message = "active 값을 보내 주세요.")
        Boolean active
) {
}
