package com.teacat.server.inquiry.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/** 관리자 목록 상단에 보여줄 처리 현황 */
@Schema(description = "문의 처리 현황")
public record InquiryStatsResponse(

        @Schema(description = "답변 대기", example = "3")
        long open,

        @Schema(description = "답변 완료(해결 전)", example = "5")
        long answered,

        @Schema(description = "해결 완료", example = "12")
        long resolved
) {
}
