package com.teacat.server.inquiry.dto.request;

import com.teacat.server.inquiry.entity.Inquiry;
import com.teacat.server.inquiry.entity.InquiryType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(description = "문의 등록 요청")
public record InquiryCreateRequest(

        @Schema(description = "문의 유형", example = "BUG")
        @NotNull(message = "문의 유형을 선택해 주세요.")
        InquiryType type,

        @Schema(description = "제목", example = "결제 후 티켓이 안 보여요")
        @NotBlank(message = "제목을 입력해 주세요.")
        @Size(max = Inquiry.TITLE_MAX_LENGTH, message = "제목은 100자를 넘을 수 없습니다.")
        String title,

        @Schema(description = "내용", example = "결제는 완료됐는데 내 예매 내역에 아무것도 없습니다.")
        @NotBlank(message = "내용을 입력해 주세요.")
        @Size(max = 2000, message = "내용은 2000자를 넘을 수 없습니다.")
        String content
) {
}
