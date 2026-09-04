package com.teacat.server.performance.dto.response;

import com.teacat.server.common.storage.FileStorageService;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 이미지 업로드 URL 발급 응답 (API-270).
 *
 * 클라이언트는 uploadUrl 로 파일을 PUT 한 뒤, key 를 공연 등록·수정 API 에 넘긴다.
 * 파일 바이트가 서버를 거치지 않아 서버 자원을 쓰지 않는다.
 */
@Schema(description = "이미지 업로드 URL 발급 응답")
public record PresignedUploadResponse(

        @Schema(description = "업로드할 주소. 이 URL 로 파일을 PUT 한다")
        String uploadUrl,

        @Schema(description = "업로드가 끝나면 등록·수정 API 에 넘길 저장 key",
                example = "performance/poster/2026/09/a1b2c3.png")
        String key,

        @Schema(description = "업로드 URL 유효시간 (초)", example = "600")
        long expiresInSeconds
) {

    public static PresignedUploadResponse from(FileStorageService.PresignedUpload upload) {
        return new PresignedUploadResponse(upload.uploadUrl(), upload.key(), upload.expiresInSeconds());
    }
}
