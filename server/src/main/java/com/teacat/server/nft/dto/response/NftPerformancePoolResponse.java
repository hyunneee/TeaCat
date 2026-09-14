package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * 공연 뽑기 풀 응답.
 *
 * <p>도안 목록만 주면 어드민이 "이 수량이 관객 수에 맞나" 를 손으로 계산해야 한다. 수량은 공연
 * 단위이고 관객은 회차마다 있어서 <b>회차 수만큼 곱하는 것을 잊기 쉽다.</b> 그래서 좌석 합계를
 * 함께 내려 화면이 경고할 수 있게 한다.
 */
@Schema(description = "공연 뽑기 풀")
public record NftPerformancePoolResponse(

        @Schema(description = "전 회차 좌석 합계 (구역 정원 합 × 회차 수)", example = "300")
        long seatCapacity,

        @Schema(description = "이 공연 도안들의 잔여 합계", example = "300")
        int poolRemaining,

        @Schema(description = "잔여 합계가 좌석 합계 이상인가. false 면 뒤쪽 관객이 못 뽑는다",
                example = "true")
        boolean sufficient,

        @Schema(description = "이 공연의 뽑기 풀 도안들")
        List<NftPhotocardDesignResponse> designs
) {

    public static NftPerformancePoolResponse of(long seatCapacity,
                                                List<NftPhotocardDesignResponse> designs) {
        int remaining = designs.stream().mapToInt(NftPhotocardDesignResponse::remaining).sum();
        return new NftPerformancePoolResponse(
                seatCapacity, remaining, remaining >= seatCapacity, designs);
    }
}
