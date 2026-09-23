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

        @Schema(description = "획득한 이벤트 이름. 이벤트 팩이 아니면 null")
        String eventName,

        @Schema(description = "판매가(CAT)", example = "3000")
        Long price,

        @Schema(description = "판매자 닉네임", example = "고척돔지박령")
        String sellerNickname,

        @Schema(description = "상세 조회 수", example = "42")
        long viewCount,

        /* 🔴 꾸민 카드는 **마켓에서도 꾸민 모습**으로 보인다 (2026-09-23).
           사는 사람이 그 꾸밈을 **그대로 받기** 때문에 보여줘도 속이는 것이 아니다.
           ⚠️ 2026-09-22 에는 "마켓에는 절대 넣지 마라" 였다. 그때는 팔릴 때 꾸밈을 지워
              보여준 것과 받는 것이 달랐다. 그 규칙이 바뀌면서 이 필드가 들어왔다 —
              **둘은 한 쌍이다.** 다시 "꾸미기 전 모습으로 판매" 로 돌아간다면 이 필드부터 빼야 한다. */
        @Schema(description = "꾸민 카드 이미지 URL. 꾸미지 않았으면 null 입니다")
        String decoratedImageUrl
) {
}

