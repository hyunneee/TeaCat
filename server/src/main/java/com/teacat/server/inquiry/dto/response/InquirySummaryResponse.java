package com.teacat.server.inquiry.dto.response;

import com.teacat.server.inquiry.entity.Inquiry;
import com.teacat.server.inquiry.entity.InquiryStatus;
import com.teacat.server.inquiry.entity.InquiryType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/** 목록용. 본문·답변 전문은 상세에서 받는다 */
@Schema(description = "문의 목록 항목")
public record InquirySummaryResponse(

        @Schema(description = "문의 ID", example = "1")
        Long inquiryId,

        @Schema(description = "문의 유형", example = "BUG")
        InquiryType type,

        @Schema(description = "상태", example = "OPEN")
        InquiryStatus status,

        @Schema(description = "제목", example = "결제 후 티켓이 안 보여요")
        String title,

        @Schema(description = "작성자 닉네임", example = "티캣냥이")
        String writerNickname,

        @Schema(description = "작성 일시")
        LocalDateTime createdAt
) {

    public static InquirySummaryResponse from(Inquiry inquiry) {
        return new InquirySummaryResponse(
                inquiry.getId(),
                inquiry.getType(),
                inquiry.getStatus(),
                inquiry.getTitle(),
                inquiry.getUser().getNickname(),
                inquiry.getCreatedAt()
        );
    }
}
