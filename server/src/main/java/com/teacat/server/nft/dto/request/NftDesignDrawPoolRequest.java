package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "도안을 뽑기 풀에서 빼거나 다시 넣는 요청")
public record NftDesignDrawPoolRequest(

        @Schema(description = "false 로 내리면 앞으로 뽑히지 않는다. 이미 발행된 카드는 그대로다",
                example = "false")
        @NotNull(message = "drawPool 값을 보내 주세요.")
        Boolean drawPool
) {
}
