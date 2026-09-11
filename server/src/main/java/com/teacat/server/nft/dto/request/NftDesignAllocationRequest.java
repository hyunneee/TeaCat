package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record NftDesignAllocationRequest(

        @Schema(description = "포토카드 도안 ID", example = "11")
        @NotNull(message = "도안 ID를 입력해 주세요.")
        @Positive(message = "도안 ID는 양수여야 합니다.")
        Long designId,

        @Schema(description = "배정 수량", example = "5", minimum = "1")
        @Positive(message = "도안 배정 수량은 1 이상이어야 합니다.")
        int quantity
) {
}

