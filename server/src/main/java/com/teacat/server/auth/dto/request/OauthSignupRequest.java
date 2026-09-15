package com.teacat.server.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * SSAFY 인증을 마친 사람의 추가정보.
 *
 * 이메일은 SSAFY 가 알려준 값을 쓰므로 여기서 받지 않는다(사용자가 바꿔 보낼 수 없어야 한다).
 */
@Schema(description = "SSAFY 회원가입 추가정보")
public record OauthSignupRequest(

        @Schema(description = "이름", example = "김싸피")
        @NotBlank(message = "이름을 입력해 주세요.")
        @Size(max = 50, message = "이름은 50자를 넘을 수 없습니다.")
        String name,

        @Schema(description = "닉네임 (한글/영문/숫자 2~20자)", example = "티캣냥이")
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
        String phone
) {
}
