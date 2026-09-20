package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * 심사 승인·거절 요청 본문. 거절은 사유가 필수인데 그 검사는 서비스가 한다 —
 * 승인과 같은 DTO 를 쓰되 빈 사유로 거절하면 {@code NFT_058} 이다.
 */
public record NftTradeReviewDecisionRequest(

        @Schema(description = "결정 사유. 거절은 필수, 승인은 선택", example = "판매자와 최고 입찰자가 같은 기기에서 접속")
        @Size(max = 1000, message = "사유는 1000자 이하로 입력해 주세요.")
        String note
) {
}
