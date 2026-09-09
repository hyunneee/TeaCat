package com.teacat.server.performance.dto.response;

import com.teacat.server.performance.entity.PerformanceArea;
import com.teacat.server.stadium.entity.Area;
import com.teacat.server.stadium.entity.AreaType;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 구역 등급·가격 편집 화면이 쓰는 한 줄.
 *
 * <p>{@link PerformanceAreaResponse}(관람객용)와 다른 점은 <b>아직 설정하지 않은 구역도
 * 들어온다</b>는 것이다. 편집 화면은 "이 공연장에 어떤 구역이 있고 그중 무엇을 팔기로 했는가" 를
 * 함께 보여줘야 하는데, 설정된 것만 주면 새 구역을 추가할 방법이 화면에 없다.
 *
 * <p>그래서 이 목록은 <b>공연의 배치도(stadium layout)에 있는 구역 전부</b>이고,
 * {@code selling} 이 지금 팔기로 되어 있는지를 가리킨다.
 */
@Schema(description = "공연 구역 설정 (관리자 편집용)")
public record AdminConcertAreaResponse(

        @Schema(description = "공연장 구역 ID", example = "1")
        Long areaId,

        @Schema(description = "구역 코드", example = "A")
        String areaCode,

        @Schema(description = "층·구역 등급 코드. 없을 수 있다", example = "1F")
        String levelCode,

        @Schema(description = "구역 형태", example = "SEATED")
        AreaType areaType,

        @Schema(description = "배치도상 이 구역의 좌석 수. 최대 판매수량을 정할 때의 상한 기준", example = "520")
        int capacity,

        @Schema(description = "이 공연에서 판매하는 구역인가. false 면 아래 설정값은 전부 null", example = "true")
        boolean selling,

        @Schema(description = "좌석 등급. 설정 전이면 null", example = "VIP")
        String grade,

        @Schema(description = "가격(원). 설정 전이면 null — 가격이 없으면 예매할 수 없다", example = "165000")
        Integer price,

        @Schema(description = "최대 판매수량. 설정 전이면 null", example = "500")
        Integer maxCnt,

        @Schema(description = "이미 팔린 수량. 이 아래로는 최대 판매수량을 줄일 수 없다", example = "0")
        long soldCnt
) {

    /**
     * @param setting 이 공연에서 이 구역을 팔기로 설정해 둔 값. 설정 전이면 {@code null}
     * @param soldCnt 확정 티켓 수
     */
    public static AdminConcertAreaResponse of(Area area, PerformanceArea setting, long soldCnt) {
        return new AdminConcertAreaResponse(
                area.getId(),
                area.getAreaCode(),
                area.getLevelCode(),
                area.getType(),
                area.getMaxSeat(),
                setting != null,
                setting == null ? null : setting.getGrade(),
                setting == null ? null : setting.getPrice(),
                setting == null ? null : setting.getMaxCnt(),
                soldCnt);
    }
}
