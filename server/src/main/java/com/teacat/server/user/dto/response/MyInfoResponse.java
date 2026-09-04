package com.teacat.server.user.dto.response;

import com.teacat.server.user.entity.User;
import com.teacat.server.user.entity.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "내 정보 응답")
public record MyInfoResponse(

        @Schema(description = "회원 ID", example = "1")
        Long userId,

        @Schema(description = "이메일", example = "teacat@teacat.com")
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

        @Schema(description = "가입 일시")
        LocalDateTime createdAt
) {

    public static MyInfoResponse from(User user) {
        return new MyInfoResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getNickname(),
                user.getPhone(),
                user.getRole(),
                user.hasFace(),
                user.getCreatedAt()
        );
    }
}
