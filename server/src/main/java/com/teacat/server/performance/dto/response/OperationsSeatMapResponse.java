package com.teacat.server.performance.dto.response;

import com.teacat.server.stadium.entity.AreaType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 운영 좌석맵 — 한 회차의 배치 위에 <b>예매·선점·입장</b> 상태를 얹은 것.
 *
 * <p>🔴 <b>예매자 개인정보는 담지 않는다.</b> 좌석마다 이름·연락처를 실으면 좌석 수만큼의
 * 명부가 한 번의 응답으로 빠져나간다. 좌석에는 티켓 번호까지만 두고, 누가 앉는지는 그 좌석을
 * 눌렀을 때 {@code /attendees/{ticketId}} 로 한 건씩 조회한다.
 *
 * <p>공개 좌석맵({@code /schedules/{id}/seats})과 <b>다른 응답</b>이다. 공개 쪽은 1초 캐시를
 * 공유하므로 운영 정보를 섞으면 관람객에게도 나간다.
 */
@Schema(description = "운영 좌석맵 - 회차 배치와 예매·입장 현황")
public record OperationsSeatMapResponse(

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

        @Schema(description = "이 응답을 만든 서버 시각. 화면의 '마지막 갱신' 이 쓴다")
        LocalDateTime serverTime,

        @Schema(description = "회차 전체 집계")
        Summary summary,

        @Schema(description = "구역 목록. 스탠딩 구역은 좌석 배열이 비어 있다")
        List<Area> areas
) {

    /**
     * 회차 전체 집계.
     *
     * <p>예매 수는 <b>취소되지 않은 티켓</b>의 수다. 좌석 상태(SOLD)로 세지 않는다 —
     * 취소된 좌석은 다시 AVAILABLE 로 풀리지만, 그사이 재판매되지 않았다면 좌석 쪽 숫자와
     * 티켓 쪽 숫자가 어긋난다. 명단의 기준이 티켓이므로 집계도 티켓으로 센다.
     */
    @Schema(description = "회차 집계")
    public record Summary(
            @Schema(description = "유효한 예매 수(취소 제외)", example = "320")
            int bookedCount,

            @Schema(description = "입장 완료 수", example = "180")
            int checkedInCount,

            @Schema(description = "아직 입장하지 않은 수", example = "140")
            int notCheckedInCount,

            @Schema(description = "지금 선점(결제 진행) 중인 좌석 수", example = "3")
            int heldCount
    ) {
    }

    /**
     * 구역 하나.
     *
     * <p>🔴 <b>스탠딩 구역은 좌석을 그리지 않는다.</b> 스탠딩에도 정원만큼의 가상 좌석 행이
     * 있지만(좌표가 없다) 그걸 좌석맵에 뿌리면 존재하지 않는 자리 번호를 운영자에게 보여주는
     * 셈이다. 정원·예매·입장 수와 명단으로만 다룬다.
     */
    @Schema(description = "구역과 그 좌석들")
    public record Area(
            @Schema(description = "구역 ID", example = "7")
            Long areaId,

            @Schema(description = "구역 코드", example = "A")
            String areaCode,

            @Schema(description = "판매 방식. STANDING 이면 좌석 배열이 비어 있다", example = "SEATED")
            AreaType saleType,

            @Schema(description = "좌석 등급", example = "VIP")
            String grade,

            @Schema(description = "좌석 가격", example = "150000")
            Integer price,

            @Schema(description = "도면 X 좌표")
            BigDecimal areaX,

            @Schema(description = "도면 Y 좌표")
            BigDecimal areaY,

            @Schema(description = "도면 너비")
            BigDecimal width,

            @Schema(description = "도면 높이")
            BigDecimal height,

            @Schema(description = "정원 — 좌석제는 판매 좌석 수, 스탠딩은 최대 판매 수량", example = "120")
            int capacity,

            @Schema(description = "이 구역의 유효한 예매 수", example = "88")
            int bookedCount,

            @Schema(description = "이 구역의 입장 완료 수", example = "50")
            int checkedInCount,

            @Schema(description = "좌석 목록. 스탠딩이면 빈 배열")
            List<Seat> seats
    ) {
    }

    /** 좌석 한 자리 */
    @Schema(description = "좌석 한 자리와 그 상태")
    public record Seat(
            @Schema(description = "좌석 ID", example = "5001")
            Long seatId,

            @Schema(description = "열", example = "3")
            String rowLabel,

            @Schema(description = "좌석 번호", example = "12")
            Integer seatNumber,

            @Schema(description = "도면 X 좌표")
            BigDecimal seatX,

            @Schema(description = "도면 Y 좌표")
            BigDecimal seatY,

            @Schema(description = "좌석 상태")
            SeatState state,

            @Schema(description = "이 좌석의 티켓 번호. 예매된 좌석만 있다", example = "1024")
            Long ticketId
    ) {
    }

    /**
     * 운영자가 보는 좌석 상태.
     *
     * <p>🔴 예매용 좌석 상태({@code SeatBookingStatus})와 <b>다른 축이 하나 더 있다</b> —
     * 입장 여부다. 예매 상태 한 칸에 섞으면 "입장했는데 취소된 표" 를 표현할 수 없다
     * ({@code Ticket.checkedInAt} 주석과 같은 이유).
     */
    @Schema(description = "AVAILABLE 빈자리 · HELD 선점 · BOOKED 예매 완료 · CHECKED_IN 입장 완료 · BLOCKED 판매 제외")
    public enum SeatState {
        AVAILABLE,
        HELD,
        BOOKED,
        CHECKED_IN,
        BLOCKED
    }
}
