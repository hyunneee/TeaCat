package com.teacat.server.performance.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 공연 이미지 업로드 URL 발급 요청 (API-270).
 */
@Schema(description = "이미지 업로드 URL 발급 요청")
public record PresignedUploadRequest(

        @Schema(description = "이미지 용도", example = "POSTER")
        @NotNull(message = "이미지 용도를 선택해 주세요.")
        ImageType imageType,

        @Schema(description = "올릴 파일의 MIME 타입", example = "image/png")
        @NotBlank(message = "파일 형식을 알려주세요.")
        String contentType
) {

    @Schema(description = "이미지 용도. 저장 경로가 달라진다")
    public enum ImageType {
        /** 목록·상세에 쓰는 포스터 */
        POSTER,
        /** 상세 페이지 본문 이미지 */
        DETAIL
    }
}
