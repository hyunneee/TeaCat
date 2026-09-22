package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftAuctionStatus;
import com.teacat.server.nft.repository.NftAuctionQueryRepository;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 어드민 경매 목록의 한 줄.
 *
 * <p>사용자용 {@link NftAuctionResponse} 를 재사용하지 않는다 — 저쪽에는 판매자·낙찰자
 * 닉네임과 상태 이력이 없고, 여기에는 <b>취소할 수 있는지</b>가 들어간다.
 */
@Schema(description = "어드민 경매 목록 항목")
public record NftAdminAuctionResponse(

        @Schema(description = "경매 ID", example = "12")
        Long auctionId,

        @Schema(description = "포토카드 ID", example = "501")
        Long photocardId,

        @Schema(description = "도안명")
        String designName,

        @Schema(description = "이미지 URL")
        String imageUrl,

        @Schema(description = "공연명. 뽑기 카드는 null")
        String performanceTitle,

        @Schema(description = "판매자 닉네임")
        String sellerNickname,

        @Schema(description = "낙찰자 닉네임. 낙찰·정산 중이 아니면 null")
        String winnerNickname,

        @Schema(description = "경매 상태", example = "ACTIVE")
        NftAuctionStatus status,

        @Schema(description = "시작가(CAT)", example = "1000")
        Long startPrice,

        @Schema(description = "현재가(CAT). 입찰 전에는 시작가", example = "1500")
        Long currentPrice,

        @Schema(description = "즉시구매가(CAT). 없으면 null")
        Long buyNowPrice,

        @Schema(description = "입찰 수", example = "4")
        int bidCount,

        @Schema(description = "마감 시각")
        LocalDateTime endsAt,

        @Schema(description = "등록 시각")
        LocalDateTime createdAt,

        @Schema(description = "닫힌 시각. 진행 중이면 null")
        LocalDateTime closedAt,

        /*
         * 🔴 규칙을 화면이 복제하지 않게 서버가 판정해 내려준다.
         *
         * 조건이 둘이고(ACTIVE 이며 마감 시각 전) 둘 다 화면에서 재현하려면 시계까지 맞춰야
         * 하는데, 어드민 브라우저 시계는 서버와 다를 수 있다. 화면이 "취소 가능" 이라 믿고
         * 버튼을 열어 놓으면 눌렀을 때 실패하는 버튼이 된다.
         */
        @Schema(description = "강제 취소할 수 있는가. 진행 중이고 마감 시각이 지나지 않은 경매만 true")
        boolean cancellable
) {

    public static NftAdminAuctionResponse of(NftAuctionQueryRepository.AuctionRow row, LocalDateTime now) {
        return new NftAdminAuctionResponse(
                row.auctionId(),
                row.photocardId(),
                row.designName(),
                row.imageUrl(),
                row.performanceTitle(),
                row.sellerNickname(),
                row.winnerNickname(),
                row.status(),
                row.startPrice(),
                row.currentPrice(),
                row.buyNowPrice(),
                row.bidCount(),
                row.endsAt(),
                row.createdAt(),
                row.closedAt(),
                row.status() == NftAuctionStatus.ACTIVE && row.endsAt().isAfter(now)
        );
    }
}
