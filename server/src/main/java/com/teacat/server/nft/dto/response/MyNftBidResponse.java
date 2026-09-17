package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftAuctionStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/** 내가 입찰한 경매 한 건. 여러 번 입찰했어도 경매 단위로 한 줄이다 */
public record MyNftBidResponse(
        @Schema(description = "경매 ID", example = "12") Long auctionId,
        @Schema(description = "포토카드 ID", example = "501") Long photocardId,
        @Schema(description = "도안명") String designName,
        @Schema(description = "이미지 URL") String imageUrl,
        @Schema(description = "내가 넣은 가장 높은 입찰가(CAT)", example = "1800") Long myHighestBid,
        @Schema(description = "현재가(CAT). 종료 후에는 체결가", example = "2000") Long currentPrice,
        @Schema(description = "내가 현재 최고 입찰자인지", example = "false") boolean isTopBidder,
        @Schema(description = "경매 상태", example = "ACTIVE") NftAuctionStatus status,
        @Schema(description = "마감 시각") LocalDateTime endsAt,
        @Schema(description = "내 관점의 결과", example = "OUTBID") Result result
) {

    public enum Result {
        /** 진행 중, 내가 최고 */
        BIDDING,
        /** 진행 중, 밀림 */
        OUTBID,
        /** 낙찰됐지만 온체인 정산이 아직 끝나지 않음 */
        SETTLING,
        WON,
        LOST
    }
}
