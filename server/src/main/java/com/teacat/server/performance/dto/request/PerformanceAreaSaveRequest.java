package com.teacat.server.performance.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 공연 구역 등급·가격 일괄 저장 요청 (API-268).
 *
 * PUT 이므로 보낸 목록이 전체가 된다. 빠진 구역은 판매하지 않는다는 뜻으로 삭제된다.
 */
@Schema(description = "공연 구역 등급·가격 일괄 저장 요청")
public record PerformanceAreaSaveRequest(

        @Schema(description = "설정할 구역 목록. 보낸 것이 전체가 된다")
        @NotEmpty(message = "구역을 하나 이상 설정해 주세요.")
        @Valid
        List<AreaSetting> areas
) {

    @Schema(description = "구역별 설정")
    public record AreaSetting(

            @Schema(description = "공연장 구역 ID", example = "1")
            @NotNull(message = "구역을 선택해 주세요.")
            Long areaId,

            @Schema(description = "좌석 등급", example = "VIP")
            @Size(max = 20, message = "등급은 20자 이하여야 합니다.")
            String grade,

            @Schema(description = "가격 (원)", example = "165000")
            @Min(value = 0, message = "가격은 0 이상이어야 합니다.")
            Integer price,

            @Schema(description = "이 구역에서 팔 최대 수량", example = "500")
            @Min(value = 0, message = "최대 판매수량은 0 이상이어야 합니다.")
            Integer maxCnt
    ) {
    }
}
