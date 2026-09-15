package com.teacat.server.user.dto.request;

import com.teacat.server.user.entity.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 관리자용 회원 정보 수정. <b>보낸 필드만</b> 바꾼다 (null 은 "그대로 둠").
 *
 * 이메일은 여기서 바꾸지 않는다 — 로그인 아이디이자 SSAFY 계정 연결의 기준값이라
 * 바꾸면 연결이 끊긴다. 필요해지면 별도 API 로 다룬다.
 */
@Schema(description = "관리자용 회원 정보 수정 요청 (보낸 필드만 변경)")
public record AdminUserUpdateRequest(

        @Schema(description = "이름", example = "김싸피")
        @Size(max = 50, message = "이름은 50자를 넘을 수 없습니다.")
        String name,

        @Schema(description = "닉네임 (한글/영문/숫자 2~20자)", example = "티캣냥이")
        @Pattern(
                regexp = "^[ㄱ-ㅣ가-힣a-zA-Z0-9]{2,20}$",
                message = "닉네임은 한글·영문·숫자 2~20자여야 합니다."
        )
        String nickname,

        @Schema(description = "휴대폰 번호", example = "010-1234-5678")
        @Pattern(
                regexp = "^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$",
                message = "휴대폰 번호 형식이 올바르지 않습니다."
        )
        String phone,

        @Schema(description = "권한", example = "PERFORMANCE")
        UserRole role
) {
}
