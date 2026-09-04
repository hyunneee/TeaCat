package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record NftPhotocardIssueResponse(
        @Schema(description = "발급된 포토카드 수", example = "400") int issuedCount,
        @Schema(description = "민팅 실패 수. 블록체인 미연동 기간에는 항상 0", example = "0") int failedCount
) {
}
