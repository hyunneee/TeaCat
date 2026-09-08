package com.teacat.server.stadium.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "공연장 등록 요청")
public record StadiumCreateRequest(
        @Schema(description = "공연장 이름", example = "고척스카이돔")
        @NotBlank @Size(max = 100) String name,

        @Schema(description = "공연장 주소", example = "서울 구로구 경인로 430")
        @NotBlank @Size(max = 255) String address,

        @Schema(description = "공연장 전화번호", example = "02-2128-2300")
        @Pattern(regexp = ".*\\S.*", message = "전화번호는 공백일 수 없습니다.")
        @Size(max = 20) String phone
) {
}
