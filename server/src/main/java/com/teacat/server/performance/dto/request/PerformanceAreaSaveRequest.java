package com.teacat.server.performance.dto.request;

import com.teacat.server.stadium.entity.AreaType;
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

            @Schema(description = """
                    이 구역에서 받을 인원의 상한.

                    - `STANDING` 으로 파는 구역은 **필수**입니다. 좌석 행이 없어 이 값이 인원을 제한하는
                      유일한 근거이고, 비우면 무제한이 됩니다 (PERFORMANCE_024).
                    - `SEATED` 로 파는 구역은 생략할 수 있습니다. 좌석 행 수가 곧 상한입니다.
                    """, example = "500")
            @Min(value = 0, message = "받을 인원 상한은 0 이상이어야 합니다.")
            Integer maxCnt,

            @Schema(description = """
                    이 공연에서 이 구역을 파는 방식. 생략하면 이미 저장된 방식을 그대로 둡니다
                    (아직 설정하지 않은 구역이면 공연장 구역의 형태를 씁니다).

                    기준은 의자가 설치돼 있는지 하나입니다.

                    - 의자가 깔린 구역(`areas.type = SEATED`)은 `SEATED` 로만 팝니다.
                      `STANDING` 은 거절합니다 — 의자가 그 자리에 있어 사람을 세울 수 없습니다
                      (PERFORMANCE_022). 의자를 치운 구성은 무대 형식을 따로 만들어 표현하세요.
                    - 의자가 없는 구역(`areas.type = STANDING`)은 둘 다 됩니다.
                      `STANDING` 이면 좌석을 만들지 않고 `maxCnt` 로 인원만 관리하고,
                      `SEATED` 면 그 구역에 등록된 좌석을 그대로 팝니다.
                    - 판매 이력이 있는 구역은 바꿀 수 없습니다 (PERFORMANCE_023).
                    """, example = "SEATED")
            AreaType saleType
    ) {
    }
}
