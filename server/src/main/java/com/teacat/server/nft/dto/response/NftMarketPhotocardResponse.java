package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record NftMarketPhotocardResponse(

        @Schema(description = "포토카드 ID", example = "501")
        Long photocardId,

        @Schema(description = "판매 등록 ID", example = "200")
        Long listingId,

        @Schema(description = "도안명", example = "1차 배포 이벤트 - 당첨")
        String designName,

        @Schema(description = "이미지 URL", example = "/uploads/photocards/design_11.png")
        String imageUrl,

        @Schema(description = "공연명", example = "TeaCat 쇼케이스")
        String performanceTitle,

        @Schema(description = "판매가(CAT)", example = "3000")
        Long price,

        @Schema(description = "판매자 닉네임", example = "고척돔지박령")
        String sellerNickname,

        @Schema(description = "상세 조회 수", example = "42")
        long viewCount
) {
}

