package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * 심사 목록 페이지. Spring 의 Page 를 그대로 내리면 내부 구조가 API 스펙이 되므로 필요한 것만 추린다
 * ({@code InquiryPageResponse} 와 같은 이유).
 */
@Schema(description = "거래 심사 목록 페이지")
public record NftTradeReviewPageResponse(

        @Schema(description = "목록")
        List<NftTradeReviewSummaryResponse> reviews,

        @Schema(description = "현재 페이지 (0부터)", example = "0")
        int page,

        @Schema(description = "페이지 크기", example = "20")
        int size,

        @Schema(description = "전체 개수", example = "7")
        long totalElements,

        @Schema(description = "전체 페이지 수", example = "1")
        int totalPages
) {

    public static NftTradeReviewPageResponse from(Page<NftTradeReviewSummaryResponse> page) {
        return new NftTradeReviewPageResponse(
                page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }
}
