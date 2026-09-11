package com.teacat.server.user.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@Schema(description = "닉네임 변경 요청")
public record NicknameChangeRequest(

        @Schema(description = "새 닉네임 (한글/영문/숫자 2~20자)", example = "티캣집사")
        @NotBlank(message = "닉네임을 입력해 주세요.")
        @Pattern(
                regexp = "^[가-힣a-zA-Z0-9]{2,20}$",
                message = "닉네임은 한글·영문·숫자 2~20자여야 합니다."
        )
        String nickname
) {
}
