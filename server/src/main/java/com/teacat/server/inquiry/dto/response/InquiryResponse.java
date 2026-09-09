package com.teacat.server.inquiry.dto.response;

import com.teacat.server.inquiry.entity.Inquiry;
import com.teacat.server.inquiry.entity.InquiryStatus;
import com.teacat.server.inquiry.entity.InquiryType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 문의 상세.
 *
 * 관리자 화면에서는 작성자를 함께 보여준다. 작성자 본인이 볼 때는 자기 글이라 굳이 필요 없지만,
 * 같은 응답을 쓰는 편이 화면과 타입이 갈라지지 않아 낫다.
 */
@Schema(description = "문의 상세")
public record InquiryResponse(

        @Schema(description = "문의 ID", example = "1")
        Long inquiryId,

        @Schema(description = "문의 유형", example = "BUG")
        InquiryType type,

        @Schema(description = "상태", example = "ANSWERED")
        InquiryStatus status,

        @Schema(description = "제목", example = "결제 후 티켓이 안 보여요")
        String title,

        @Schema(description = "내용")
        String content,

        @Schema(description = "작성자 닉네임", example = "티캣냥이")
        String writerNickname,

        @Schema(description = "관리자 답변. 아직 없으면 null")
        String answer,

        @Schema(description = "답변한 관리자 닉네임. 아직 없으면 null")
        String answeredByNickname,

        @Schema(description = "답변 일시. 아직 없으면 null")
        LocalDateTime answeredAt,

        @Schema(description = "해결 처리 일시. 아직이면 null")
        LocalDateTime resolvedAt,

        @Schema(description = "작성 일시")
        LocalDateTime createdAt,

        @Schema(description = "작성자가 수정·삭제할 수 있는지. 답변이 달리면 false 가 된다", example = "true")
        boolean editable
) {

    public static InquiryResponse from(Inquiry inquiry) {
        return new InquiryResponse(
                inquiry.getId(),
                inquiry.getType(),
                inquiry.getStatus(),
                inquiry.getTitle(),
                inquiry.getContent(),
                inquiry.getUser().getNickname(),
                inquiry.getAnswer(),
                inquiry.getAnsweredBy() == null ? null : inquiry.getAnsweredBy().getNickname(),
                inquiry.getAnsweredAt(),
                inquiry.getResolvedAt(),
                inquiry.getCreatedAt(),
                !inquiry.isAnswered()
        );
    }
}
