package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftMintStatus;
import com.teacat.server.nft.entity.NftPhotocardGrade;
import io.swagger.v3.oas.annotations.media.Schema;

public record MyNftPhotocardResponse(
        @Schema(description = "포토카드 ID") Long photocardId,
        @Schema(description = "도안명") String designName,
        @Schema(description = "이미지 URL") String imageUrl,
        @Schema(description = "공연명. 뽑기 카드는 null") String performanceTitle,
        @Schema(description = "민팅 상태") NftMintStatus status,
        @Schema(description = "고정가 또는 경매 판매 진행 여부") boolean listed,
        @Schema(description = "판매 방식. 판매 중이 아니면 null", example = "AUCTION") MarketType marketType,
        @Schema(description = "판매 상태. 판매 중이 아니면 null", example = "SETTLING") MarketStatus marketStatus,
        @Schema(description = "소속 (뽑기 풀 도안만)", example = "서울 5반") String group,
        @Schema(description = "연출 등급 (뽑기 풀 도안만)", example = "SPECIAL") NftPhotocardGrade grade,
        @Schema(description = "같은 도안의 지난 거래 평균가(CAT). 거래가 없으면 null", example = "1500") Long averagePrice
) {
    public enum MarketType {
        FIXED_PRICE,
        AUCTION
    }

    public enum MarketStatus {
        ACTIVE,
        SETTLING
    }
}
