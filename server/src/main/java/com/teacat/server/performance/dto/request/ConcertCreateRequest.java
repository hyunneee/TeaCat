package com.teacat.server.performance.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 공연 등록 요청 (API-261).
 *
 * 포스터·상세 이미지를 함께 올려야 해서 multipart/form-data 로 받는다.
 * 업로드 URL 발급 API(API-270)가 붙으면 파일 대신 key 를 받는 방식으로 바꿀 수 있다.
 */
@Schema(description = "공연 등록 요청 (multipart/form-data)")
public record ConcertCreateRequest(

        @Schema(description = "공연장 ID", example = "1")
        @NotNull(message = "공연장을 선택해 주세요.")
        Long stadiumId,

        @Schema(description = "공연 제목", example = "티캣 단독 콘서트 2026")
        @NotBlank(message = "공연 제목을 입력해 주세요.")
        @Size(max = 200, message = "공연 제목은 200자 이하여야 합니다.")
        String title,

        @Schema(description = "티켓팅 오픈 시각", example = "2026-10-01T20:00:00")
        @NotNull(message = "티켓팅 오픈 시각을 입력해 주세요.")
        LocalDateTime ticketingStartAt,

        @Schema(description = "목록 노출 시작일", example = "2026-09-20")
        @NotNull(message = "노출 시작일을 입력해 주세요.")
        LocalDate visibleFrom,

        @Schema(description = "포스터 이미지 (jpg/png/webp/gif, 5MB 이하)")
        MultipartFile poster,

        @Schema(description = "상세 페이지 이미지 (jpg/png/webp/gif, 20MB 이하)")
        MultipartFile detailImage
) {
}
