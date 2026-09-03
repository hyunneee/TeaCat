package com.teacat.server.auth.dto.response;

import com.teacat.server.auth.client.OauthProfile;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 추가정보 입력 화면을 그리기 위한 값.
 *
 * SSAFY 가 알려준 것만 내려준다. 나머지(닉네임·전화번호)는 사용자가 채운다.
 */
@Schema(description = "SSAFY 가입 대기 정보")
public record PendingSignupResponse(

        @Schema(description = "SSAFY 계정 이메일", example = "teacat@ssafy.com")
        String email,

        @Schema(description = "SSAFY 계정 이름. 없으면 null", example = "김싸피")
        String name
) {

    public static PendingSignupResponse from(OauthProfile profile) {
        return new PendingSignupResponse(profile.email(), profile.name());
    }
}
