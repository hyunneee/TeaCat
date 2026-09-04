package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftListingStatus;
import com.teacat.server.nft.entity.NftPhotocardListing;
import io.swagger.v3.oas.annotations.media.Schema;

public record NftListingResponse(

        @Schema(description = "판매 등록 ID", example = "200")
        Long listingId,

        @Schema(description = "판매가(CAT)", example = "3000")
        Long price,

        @Schema(description = "판매자 설명", example = "실물 카드 상태 그대로 보관 중입니다. 스크래치 없어요.")
        String description,

        @Schema(description = "판매 상태", example = "ACTIVE")
        NftListingStatus status
) {

    public static NftListingResponse from(NftPhotocardListing listing) {
        return new NftListingResponse(
                listing.getId(), listing.getPrice(), listing.getDescription(), listing.getStatus());
    }
}
