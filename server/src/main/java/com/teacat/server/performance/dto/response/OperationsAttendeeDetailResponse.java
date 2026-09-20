package com.teacat.server.performance.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 좌석을 눌렀을 때 오른쪽에 뜨는 티켓 한 장.
 *
 * <p>명단 한 줄({@link OperationsAttendeeResponse})에 <b>어느 공연의 몇 회차인지</b>를 더한
 * 것이다. 좌석맵은 개인정보를 싣지 않으므로 이 조회가 그 자리의 사람을 처음 가져온다.
 *
 * <p>🔴 <b>얼굴 임베딩·QR 비밀값은 내려보내지 않는다.</b> 운영자가 여기서 할 일은 자리와
 * 사람을 맞춰 보는 것이고, 대조는 게이트 검표(입장 확인)가 서버에서 한다.
 */
@Schema(description = "좌석·명단에서 선택한 티켓 상세 (개인정보 마스킹)")
public record OperationsAttendeeDetailResponse(

        @Schema(description = "명단 정보")
        OperationsAttendeeResponse attendee,

        @Schema(description = "공연 ID", example = "1")
        Long performanceId,

        @Schema(description = "공연명", example = "테아캣 단독 콘서트")
        String performanceTitle,

        @Schema(description = "회차 ID", example = "10")
        Long scheduleId,

        @Schema(description = "회차 번호", example = "1")
        int performanceNum,

        @Schema(description = "공연 일시")
        LocalDateTime performanceDate,

        @Schema(description = "좌석 등급. 구역 설정이 없으면 null", example = "VIP")
        String grade
) {
}
