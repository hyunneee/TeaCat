package com.teacat.server.user.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * 관리자가 회원 비밀번호를 새로 정한다.
 *
 * 현재 비밀번호를 묻지 않는다 (관리자는 모른다). 그래서 이 API 는
 * 사용자의 모든 세션을 함께 끊는다 — 안 그러면 남의 계정 비밀번호를 바꿔놓고
 * 그 사람이 로그인한 세션은 그대로 두는 셈이 된다.
 */
@Schema(description = "관리자용 비밀번호 초기화 요청")
public record AdminPasswordResetRequest(

        @Schema(description = "새 비밀번호 (영문/숫자/특수문자 포함 8~20자)", example = "teacat1234!")
        @NotBlank(message = "새 비밀번호를 입력해 주세요.")
        @Pattern(
                regexp = "^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,20}$",
                message = "비밀번호는 영문·숫자·특수문자를 모두 포함한 8~20자여야 합니다."
        )
        String newPassword
) {
}
