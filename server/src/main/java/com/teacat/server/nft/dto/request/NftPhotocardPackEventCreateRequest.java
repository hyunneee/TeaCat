package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

@Schema(description = "카드팩 이벤트 등록 요청")
public record NftPhotocardPackEventCreateRequest(

        @Schema(description = "이벤트 코드. 지급된 팩의 source_ref 가 되며 계정당 1회의 기준이다. "
                + "등록 뒤에는 바꿀 수 없다", example = "SUMMER_2026")
        @NotBlank(message = "이벤트 코드를 입력해 주세요.")
        @Size(max = 50, message = "이벤트 코드는 50자 이하여야 합니다.")
        @Pattern(regexp = "^[A-Z0-9_]+$", message = "이벤트 코드는 영문 대문자·숫자·밑줄만 쓸 수 있습니다.")
        String code,

        @Schema(description = "어드민 목록에 보일 이름", example = "여름 맞이 카드팩")
        @NotBlank(message = "이벤트 이름을 입력해 주세요.")
        @Size(max = 100, message = "이벤트 이름은 100자 이하여야 합니다.")
        String name,

        @Schema(description = "시작 시각. 비우면 즉시 시작")
        LocalDateTime startsAt,

        @Schema(description = "종료 시각. 비우면 무기한")
        LocalDateTime endsAt
) {
}
