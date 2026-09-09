package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record NftPhotocardIssueResponse(
        @Schema(description = "발급된 포토카드 수", example = "400") int issuedCount,
        @Schema(description = "아직 체인에 보내지 못한 수. 0 이 아니면 발행 재시도로 이어 보낼 수 있다", example = "0") int failedCount
) {
}
