package com.teacat.server.inquiry.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * 페이지 응답.
 *
 * Spring 의 Page 를 그대로 내려주면 내부 구조(pageable, sort …)가 API 스펙이 되어
 * 라이브러리를 올릴 때 응답이 조용히 바뀐다. 필요한 것만 추려서 내려준다.
 */
@Schema(description = "문의 목록 페이지")
public record InquiryPageResponse(

        @Schema(description = "목록")
        List<InquirySummaryResponse> inquiries,

        @Schema(description = "현재 페이지 (0부터)", example = "0")
        int page,

        @Schema(description = "페이지 크기", example = "20")
        int size,

        @Schema(description = "전체 개수", example = "42")
        long totalElements,

        @Schema(description = "전체 페이지 수", example = "3")
        int totalPages
) {

    public static InquiryPageResponse from(Page<InquirySummaryResponse> page) {
        return new InquiryPageResponse(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }
}
