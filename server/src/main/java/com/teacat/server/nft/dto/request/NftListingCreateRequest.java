package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record NftListingCreateRequest(

        @Schema(description = "판매가(CAT)", example = "3000", minimum = "1")
        @NotNull(message = "판매가를 입력해 주세요.")
        @Positive(message = "판매가를 1 이상으로 입력해 주세요.")
        Long price,

        @Schema(description = "판매자 설명", example = "실물 카드 상태 그대로 보관 중입니다. 스크래치 없어요.", maxLength = 500)
        @NotBlank(message = "판매자 설명을 입력해 주세요.")
        @Size(max = 500, message = "판매자 설명은 500자 이하로 입력해 주세요.")
        String description
) {
}
