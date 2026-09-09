package com.teacat.server.stadium.dto.response;

import com.teacat.server.stadium.entity.AreaType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "구역별 좌석 목록 응답")
public record SeatListResponse(
        @Schema(description = "구역 ID", example = "10") Long areaId,
        @Schema(description = "구역 코드", example = "A") String areaCode,
        @Schema(description = "구역 유형", example = "SEATED") AreaType type,
        @Schema(description = "최대 수용 인원", example = "100") int maxSeat,
        @Schema(description = "등록 좌석 수", example = "2") int seatCount,
        @Schema(description = "좌석 목록") List<SeatResponse> seats
) {
}
