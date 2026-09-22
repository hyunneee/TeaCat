package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "카드팩 무효화 요청")
public record NftPhotocardPackInvalidateRequest(
        @Schema(description = "잘못 지급된 이유. 감사 이력으로 보존된다", example = "취소된 예매에 중복 지급됨")
        @NotBlank(message = "무효화 사유를 입력해 주세요.")
        @Size(max = 500, message = "무효화 사유는 500자 이하여야 합니다.")
        String reason
) {
}
