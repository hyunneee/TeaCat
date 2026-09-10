package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftMintStatus;
import com.teacat.server.nft.entity.NftPhotocardGrade;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record NftPhotocardDetailResponse(

        @Schema(description = "포토카드 ID", example = "501")
        Long photocardId,

        @Schema(description = "도안명")
        String designName,

        @Schema(description = "이미지 URL")
        String imageUrl,

        @Schema(description = "공연명. 뽑기 카드는 null")
        String performanceTitle,

        @Schema(description = "현재 소유자 닉네임")
        String ownerNickname,

        @Schema(description = "포토카드 발행 시각")
        LocalDateTime issuedAt,

        @Schema(description = "포토카드가 발행된 공연 좌석 정보. 뽑기 카드는 null")
        Origin origin,

        @Schema(description = "민팅 상태", example = "PENDING")
        NftMintStatus status,

        @Schema(description = "활성 판매 정보. 판매 중이 아니면 null")
        Listing listing,

        @Schema(description = "진행 중인 경매 정보. 경매 중이 아니면 null. listing 과 동시에 값이 있는 일은 없다")
        Auction auction,

        @Schema(description = "소속 (뽑기 풀 도안만)", example = "서울 5반")
        String group,

        @Schema(description = "연출 등급 (뽑기 풀 도안만)", example = "SPECIAL")
        NftPhotocardGrade grade,

        @Schema(description = "같은 도안의 지난 거래 평균가(CAT). 거래가 없으면 null", example = "1500")
        Long averagePrice
) {

    public record Auction(
            @Schema(description = "경매 ID", example = "12") Long auctionId,
            @Schema(description = "현재가(CAT)", example = "1800") Long currentPrice,
            @Schema(description = "즉시구매가(CAT). 없으면 생략", example = "5000") Long buyNowPrice,
            @Schema(description = "입찰 수", example = "4") int bidCount,
            @Schema(description = "마감 시각") LocalDateTime endsAt
    ) {
    }

    public record Listing(
            @Schema(description = "판매 등록 ID") Long listingId,
            @Schema(description = "판매가(CAT)") Long price,
            @Schema(description = "판매자 설명") String sellerDescription,
            @Schema(description = "판매 등록 시각") LocalDateTime listedAt
    ) {
    }

    public record Origin(
            @Schema(description = "좌석 등급", example = "VIP") String seatGrade,
            @Schema(description = "공연장 구역 코드", example = "A") String areaCode,
            @Schema(description = "좌석 열. 스탠딩이면 null", example = "3") String rowLabel,
            @Schema(description = "좌석 번호. 스탠딩이면 null", example = "5") Integer seatNumber
    ) {
    }
}
