package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftMintStatus;
import io.swagger.v3.oas.annotations.media.Schema;

public record MyNftPhotocardResponse(
        @Schema(description = "포토카드 ID") Long photocardId,
        @Schema(description = "도안명") String designName,
        @Schema(description = "이미지 URL") String imageUrl,
        @Schema(description = "공연명") String performanceTitle,
        @Schema(description = "민팅 상태") NftMintStatus status,
        @Schema(description = "판매 등록 여부") boolean listed
) {
}

