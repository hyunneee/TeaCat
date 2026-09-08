package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record NftAuctionCreateRequest(

        @Schema(description = "시작가(CAT)", example = "1000", minimum = "1")
        @NotNull(message = "시작가를 입력해 주세요.")
        @Positive(message = "시작가를 1 이상으로 입력해 주세요.")
        Long startPrice,

        @Schema(description = "즉시구매가(CAT). 없으면 생략. 시작가보다 높아야 한다", example = "5000", nullable = true)
        @Positive(message = "즉시구매가를 1 이상으로 입력해 주세요.")
        Long buyNowPrice,

        @Schema(description = "진행 시간(시간 단위). 서버 설정 범위(기본 1h~7d) 안이어야 한다", example = "48", minimum = "1")
        @NotNull(message = "진행 시간을 입력해 주세요.")
        @Positive(message = "진행 시간을 1시간 이상으로 입력해 주세요.")
        Integer durationHours
) {
}
