package com.teacat.server.inquiry.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "문의 답변 요청 (관리자)")
public record InquiryAnswerRequest(

        @Schema(description = "답변 내용", example = "확인 결과 결제는 정상 처리되었고, 지금은 내역에서 보이실 겁니다.")
        @NotBlank(message = "답변 내용을 입력해 주세요.")
        @Size(max = 2000, message = "답변은 2000자를 넘을 수 없습니다.")
        String answer
) {
}
