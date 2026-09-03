package com.teacat.server.user.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@Schema(description = "비밀번호 변경 요청")
public record PasswordChangeRequest(

        @Schema(description = "현재 비밀번호", example = "teacat1234!")
        @NotBlank(message = "현재 비밀번호를 입력해 주세요.")
        String currentPassword,

        @Schema(description = "새 비밀번호 (영문/숫자/특수문자 포함 8~20자)", example = "teacat5678!")
        @NotBlank(message = "새 비밀번호를 입력해 주세요.")
        @Pattern(
                regexp = "^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,20}$",
                message = "비밀번호는 영문·숫자·특수문자를 모두 포함한 8~20자여야 합니다."
        )
        String newPassword
) {
}
