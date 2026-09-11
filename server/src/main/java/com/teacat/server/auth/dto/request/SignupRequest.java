package com.teacat.server.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "회원가입 요청")
public record SignupRequest(

        @Schema(description = "이메일", example = "teacat@teacat.com")
        @NotBlank(message = "이메일을 입력해 주세요.")
        @Email(message = "이메일 형식이 올바르지 않습니다.")
        @Size(max = 255, message = "이메일은 255자를 넘을 수 없습니다.")
        String email,

        @Schema(description = "비밀번호 (영문/숫자/특수문자 포함 8~20자)", example = "teacat1234!")
        @NotBlank(message = "비밀번호를 입력해 주세요.")
        @Pattern(
                regexp = "^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,20}$",
                message = "비밀번호는 영문·숫자·특수문자를 모두 포함한 8~20자여야 합니다."
        )
        String password,

        @Schema(description = "이름", example = "김싸피")
        @NotBlank(message = "이름을 입력해 주세요.")
        @Size(max = 50, message = "이름은 50자를 넘을 수 없습니다.")
        String name,

        @Schema(description = "닉네임 (한글/영문/숫자 2~20자)", example = "티캣냥이")
        @NotBlank(message = "닉네임을 입력해 주세요.")
        @Pattern(
                regexp = "^[가-힣a-zA-Z0-9]{2,20}$",
                message = "닉네임은 한글·영문·숫자 2~20자여야 합니다."
        )
        String nickname,

        @Schema(description = "휴대폰 번호", example = "010-1234-5678")
        @NotBlank(message = "휴대폰 번호를 입력해 주세요.")
        @Pattern(
                regexp = "^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$",
                message = "휴대폰 번호 형식이 올바르지 않습니다."
        )
        String phone
) {
}
