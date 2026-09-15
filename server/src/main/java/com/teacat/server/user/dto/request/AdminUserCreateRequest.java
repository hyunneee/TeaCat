package com.teacat.server.user.dto.request;

import com.teacat.server.user.entity.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 관리자가 회원을 직접 만들 때 쓰는 요청.
 *
 * 일반 가입(SignupRequest)과 제약을 같게 두되 role 이 하나 더 있다.
 * 🔴 일반 가입에는 role 을 절대 넣지 마세요 — 누구나 스스로 ADMIN 이 됩니다.
 */
@Schema(description = "관리자용 회원 생성 요청")
public record AdminUserCreateRequest(

        @Schema(description = "이메일 (로그인 아이디)", example = "stadium@teacat.com")
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

        @Schema(description = "닉네임 (한글/영문/숫자 2~20자)", example = "고척돔운영")
        @NotBlank(message = "닉네임을 입력해 주세요.")
        @Pattern(
                regexp = "^[ㄱ-ㅣ가-힣a-zA-Z0-9]{2,20}$",
                message = "닉네임은 한글·영문·숫자 2~20자여야 합니다."
        )
        String nickname,

        @Schema(description = "휴대폰 번호", example = "010-1234-5678")
        @NotBlank(message = "휴대폰 번호를 입력해 주세요.")
        @Pattern(
                regexp = "^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$",
                message = "휴대폰 번호 형식이 올바르지 않습니다."
        )
        String phone,

        @Schema(description = "권한", example = "STADIUM")
        @NotNull(message = "권한을 선택해 주세요.")
        UserRole role
) {
}
