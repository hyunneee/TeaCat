package com.teacat.server.inquiry.dto.request;

import com.teacat.server.inquiry.entity.Inquiry;
import com.teacat.server.inquiry.entity.InquiryType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 수정은 답변이 달리기 전(OPEN)에만 됩니다. */
@Schema(description = "문의 수정 요청")
public record InquiryUpdateRequest(

        @Schema(description = "문의 유형", example = "IMPROVEMENT")
        @NotNull(message = "문의 유형을 선택해 주세요.")
        InquiryType type,

        @Schema(description = "제목", example = "결제 후 티켓이 안 보여요 (추가 정보)")
        @NotBlank(message = "제목을 입력해 주세요.")
        @Size(max = Inquiry.TITLE_MAX_LENGTH, message = "제목은 100자를 넘을 수 없습니다.")
        String title,

        @Schema(description = "내용")
        @NotBlank(message = "내용을 입력해 주세요.")
        @Size(max = 2000, message = "내용은 2000자를 넘을 수 없습니다.")
        String content
) {
}
