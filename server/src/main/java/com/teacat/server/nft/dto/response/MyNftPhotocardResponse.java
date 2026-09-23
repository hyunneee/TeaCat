package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftMintStatus;
import com.teacat.server.nft.entity.NftPhotocardGrade;
import io.swagger.v3.oas.annotations.media.Schema;

public record MyNftPhotocardResponse(
        @Schema(description = "포토카드 ID") Long photocardId,
        /* 🔴 도감이 "이 카드를 가졌나" 를 맞추는 열쇠다. 이름으로 맞추면 어드민이 도안 이름을
           바꾸는 순간 도감의 보유 표시가 통째로 어긋난다 — 이름은 표시용일 뿐이다. */
        @Schema(description = "도안 ID. 도감이 보유 여부를 이 값으로 맞춥니다", example = "11")
        Long designId,
        @Schema(description = "도안명") String designName,
        @Schema(description = "이미지 URL") String imageUrl,
        @Schema(description = "공연명. 카드팩에서 나온 카드는 null") String performanceTitle,
        @Schema(description = "획득한 이벤트 이름. 이벤트 카드팩이 아니면 null", example = "오픈 기념 카드팩")
        String eventName,
        @Schema(description = "민팅 상태") NftMintStatus status,
        @Schema(description = "고정가 또는 경매 판매 진행 여부") boolean listed,
        @Schema(description = "판매 방식. 판매 중이 아니면 null", example = "AUCTION") MarketType marketType,
        @Schema(description = "판매 상태. 판매 중이 아니면 null", example = "SETTLING") MarketStatus marketStatus,
        @Schema(description = "소속 (뽑기 풀 도안만)", example = "서울 5반") String group,
        @Schema(description = "연출 등급 (뽑기 풀 도안만)", example = "SPECIAL") NftPhotocardGrade grade,
        @Schema(description = "같은 도안의 지난 거래 평균가(CAT). 거래가 없으면 null", example = "1500") Long averagePrice,
        /* 🔴 위의 imageUrl 을 **바꿔치우지 않고 따로 둔다.** imageUrl 은 마켓·경매·거래내역
           DTO 에도 같은 이름으로 있어, 거기까지 꾸민 그림으로 바뀌면 사는 사람이 꾸며진
           그림을 보고 샀는데 맨 카드를 받는다. 이 필드는 내 카드 응답에만 있다. */
        @Schema(description = "꾸민 카드 이미지 URL. 꾸미지 않았으면 null 입니다")
        String decoratedImageUrl
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
