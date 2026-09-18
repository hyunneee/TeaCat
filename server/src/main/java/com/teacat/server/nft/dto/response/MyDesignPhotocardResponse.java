package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftMintStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 같은 도안을 여러 장 가졌을 때, 그 **한 장 한 장**.
 *
 * <p>도감은 같은 도안을 한 칸으로 묶어 {@code ×3} 으로 보여준다. 그러면 상세에서
 * "그 셋이 각각 어디서 온 것인가" 를 알 수 없고, 팔 때 <b>어느 장을 파는지</b>도 고를 수 없다.
 *
 * <p>🔴 <b>공연명으로는 구분되지 않는다.</b> 공연명은 포토카드가 아니라 <b>도안</b>에 붙어 있어서
 * (`nft_photocard_designs.performance_general_id`) 같은 도안 세 장은 전부 같은 공연명이다.
 * 실제로 갈리는 것은 <b>회차와 좌석</b>이고, 그건 포토카드의 티켓에 있다. 그래서 이 응답은
 * 공연명을 담지 않고 회차·좌석·발행 시각을 담는다 — 상세 화면이 이미 공연명을 알고 있다.
 *
 * <p>⚠️ 뽑기로 얻은 카드는 티켓이 없어 {@code origin} 과 회차가 모두 null 이다.
 * 그 경우 갈라 보는 기준은 발행 시각뿐이다.
 */
public record MyDesignPhotocardResponse(

        @Schema(description = "포토카드 ID", example = "501")
        Long photocardId,

        @Schema(description = "포토카드 발행 시각")
        LocalDateTime issuedAt,

        @Schema(description = "발행된 공연 좌석. 뽑기 카드는 null")
        NftPhotocardDetailResponse.Origin origin,

        @Schema(description = "몇 회차인가. 뽑기 카드는 null", example = "2")
        Integer performanceNum,

        @Schema(description = "그 회차의 공연 일시. 뽑기 카드는 null")
        LocalDateTime performanceDate,

        @Schema(description = "민팅 상태", example = "MINTED")
        NftMintStatus status,

        /* 🔴 판매 중인 장을 골라 또 팔 수는 없다. 화면이 그 장을 빼거나 잠그려면
           장마다 이 값이 필요하다 — 목록 전체에 하나만 있으면 안 된다. */
        @Schema(description = "판매 방식. 판매 중이 아니면 null", example = "AUCTION")
        MyNftPhotocardResponse.MarketType marketType,

        @Schema(description = "판매 상태. 판매 중이 아니면 null", example = "SETTLING")
        MyNftPhotocardResponse.MarketStatus marketStatus
) {
}
