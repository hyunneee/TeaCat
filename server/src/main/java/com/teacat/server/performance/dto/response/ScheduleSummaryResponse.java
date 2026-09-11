package com.teacat.server.performance.dto.response;

import com.teacat.server.performance.entity.BookingOpenStatus;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.performance.entity.TicketingStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "공연 회차 요약")
public record ScheduleSummaryResponse(

        @Schema(description = "회차 ID", example = "10")
        Long scheduleId,

        @Schema(description = "회차 번호", example = "1")
        int performanceNum,

        @Schema(description = "공연 일시 (시작 시각)")
        LocalDateTime performanceDate,

        @Schema(description = "회차 판매 상태(DB 값)", example = "SCHEDULED")
        TicketingStatus status,

        @Schema(description = "서버가 판단한 예매 오픈 상태", example = "BEFORE")
        BookingOpenStatus bookingStatus,

        @Schema(description = "지금 예매할 수 있는지", example = "false")
        boolean bookable
) {

    /**
     * @param soldOut 좌석이 다 팔렸는가 ({@code ScheduleSeatAvailability} 가 판정).
     *                🔴 회차 상태만으로는 알 수 없다 — SOLD_OUT 은 운영자가 손으로 바꾸는
     *                값이라, 이걸 안 넘기면 매진된 회차가 "예매 가능" 으로 나간다
     */
    public static ScheduleSummaryResponse of(PerformanceDetail detail, LocalDateTime now,
            boolean soldOut) {
        BookingOpenStatus bookingStatus = detail.bookingStatus(now).soldOutIf(soldOut);

        return new ScheduleSummaryResponse(
                detail.getId(),
                detail.getPerformanceNum(),
                detail.getPerformanceDate(),
                detail.getStatus(),
                bookingStatus,
                bookingStatus == BookingOpenStatus.OPEN
        );
    }
}
