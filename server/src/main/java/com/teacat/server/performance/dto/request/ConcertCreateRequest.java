package com.teacat.server.performance.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

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

        /*
         * 한 공연장이 무대를 U형·O형처럼 바꿀 수 있고, 그때마다 구역이 다르게 나뉜다.
         * 그 형식들이 stadium_layouts 에 미리 저장돼 있고, 공연은 그중 하나를 골라 쓴다.
         * 이 공연에서 팔 수 있는 구역은 고른 형식의 구역들뿐이다 (API-268 이 이 기준으로 검증한다).
         */
        @Schema(description = "공연장 배치(무대 형식) ID. 생략하면 공연장의 기본 배치를 쓴다", example = "1")
        Long stadiumLayoutId,

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

        /*
         * 공연 상세에서 오른쪽 아래에 뜨는 버튼 하나. 공식 사이트·아티스트 채널처럼 우리가
         * 담지 않는 정보로 보낸다. 비우면 버튼 자체가 없다.
         *
         * 🔴 이 식은 client 의 shared/lib/link.ts · BannerWriteRequest 와 **같아야 한다.**
         *    `javascript:` · `data:` 는 그대로 href 에 실리면 우리 페이지 안에서 코드가 돌고,
         *    `//evil.com` 은 경로처럼 보이지만 바깥으로 나간다.
         */
        @Schema(description = """
                공연 상세의 '바로가기' 버튼이 갈 곳 (선택).

                - 서비스 내 경로: `/nft/draw` — 같은 탭에서 이동합니다
                - 외부 주소: `https://example.com` — 새 탭으로 엽니다

                비우면 버튼이 뜨지 않습니다.
                """, example = "https://example.com/artist")
        @Pattern(regexp = "^(/(?!/)\\S*|https?://\\S+)$",
                message = "'/' 로 시작하는 서비스 내 경로이거나 http(s) 로 시작하는 주소여야 합니다.")
        @Size(max = 500, message = "주소가 너무 깁니다.")
        String linkUrl,

        @Schema(description = "포스터 이미지 (jpg/png/webp/gif, 5MB 이하)")
        MultipartFile poster,

        @Schema(description = "상세 페이지 이미지 (jpg/png/webp/gif, 20MB 이하)")
        MultipartFile detailImage,

        /*
         * 회차를 공연과 한 번에 만든다. 같은 키를 반복해서 보낸다:
         *   performanceDates=2026-11-14T19:00:00&performanceDates=2026-11-15T19:00:00
         * 회차 번호는 일시 순으로 1 부터 붙는다. 나중에 추가하려면 회차 등록(API-265)을 쓴다.
         */
        @Schema(description = "회차 공연 일시 목록 (같은 키 반복). 일시 순으로 1회차부터 번호가 붙는다. 생략 가능",
                example = "[\"2026-11-14T19:00:00\", \"2026-11-15T19:00:00\"]")
        List<@NotNull(message = "회차 일시가 비어 있습니다.") LocalDateTime> performanceDates
) {

    /** null 도 빈 목록으로 다룬다 — multipart 에서 키를 안 보내면 null 이 들어온다 */
    public List<LocalDateTime> performanceDatesOrEmpty() {
        return performanceDates == null ? List.of() : performanceDates;
    }
}
