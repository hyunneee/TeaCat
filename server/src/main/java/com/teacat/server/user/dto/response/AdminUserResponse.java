package com.teacat.server.user.dto.response;

import com.teacat.server.user.entity.User;
import com.teacat.server.user.entity.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 관리자 화면에 뿌리는 회원 한 명.
 *
 * {@link MyInfoResponse} 와 달리 관리자에게만 의미 있는 값(소셜 전용 계정 여부)을 더 준다.
 * 비밀번호 해시는 절대 내려보내지 않는다.
 */
@Schema(description = "관리자용 회원 정보")
public record AdminUserResponse(

        @Schema(description = "회원 ID", example = "1")
        Long userId,

        @Schema(description = "이메일 (로그인 아이디)", example = "teacat@teacat.com")
        String email,

        @Schema(description = "이름", example = "김싸피")
        String name,

        @Schema(description = "닉네임", example = "티캣냥이")
        String nickname,

        @Schema(description = "휴대폰 번호", example = "010-1234-5678")
        String phone,

        @Schema(description = "권한", example = "USER")
        UserRole role,

        @Schema(description = "얼굴 등록 여부", example = "true")
        boolean faceRegistered,

        @Schema(description = "비밀번호 없이 SSAFY 계정으로만 로그인하는 회원인지", example = "false")
        boolean socialOnly,

        @Schema(description = "가입 일시")
        LocalDateTime createdAt
) {

    public static AdminUserResponse from(User user) {
        return new AdminUserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getNickname(),
                user.getPhone(),
                user.getRole(),
                user.hasFace(),
                !user.hasPassword(),
                user.getCreatedAt()
        );
    }
}
