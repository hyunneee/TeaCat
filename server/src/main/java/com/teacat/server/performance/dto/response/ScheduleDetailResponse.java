package com.teacat.server.performance.dto.response;

import com.teacat.server.performance.entity.BookingOpenStatus;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.entity.TicketingStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * 회차 단건 조회 응답 (API-203).
 *
 * 예매 화면이 이 응답만으로 헤더(공연명·공연장·일시)와 예매 가능 여부를 그릴 수 있게 담는다.
 */
@Schema(description = "회차 단건 조회 응답")
public record ScheduleDetailResponse(

        @Schema(description = "회차 ID", example = "1")
        Long scheduleId,

        @Schema(description = "회차 번호", example = "1")
        int performanceNum,

        @Schema(description = "공연 일시 (시작 시각)")
        LocalDateTime performanceDate,

        @Schema(description = "회차 판매 상태(DB 값)", example = "OPEN")
        TicketingStatus status,

        @Schema(description = "서버가 판단한 예매 오픈 상태", example = "OPEN")
        BookingOpenStatus bookingStatus,

        @Schema(description = "지금 예매할 수 있는지", example = "true")
        boolean bookable,

        @Schema(description = "취소 가능 마감 시각. 공연 시작에서 booking.policy.cancel-deadline-lead 만큼 앞선 시각이다")
        LocalDateTime cancelDeadlineAt,

        @Schema(description = "공연 ID", example = "1")
        Long concertId,

        @Schema(description = "공연 제목", example = "티캣 단독 콘서트 2026")
        String concertTitle,

        @Schema(description = "공연장 이름", example = "올림픽공원 체조경기장")
        String stadiumName,

        @Schema(description = "티켓팅 오픈 시각")
        LocalDateTime ticketingStartAt
) {

    /**
     * @param soldOut 좌석이 다 팔렸는가 ({@code ScheduleSeatAvailability} 가 판정).
     *                회차 상태의 SOLD_OUT 은 운영자가 손으로 바꾸는 값이라 믿을 수 없다
     */
    public static ScheduleDetailResponse of(PerformanceDetail detail, LocalDateTime now,
                                            Duration cancelDeadlineLead, boolean soldOut) {
        PerformanceGeneral performance = detail.getPerformance();
        BookingOpenStatus bookingStatus = detail.bookingStatus(now).soldOutIf(soldOut);

        return new ScheduleDetailResponse(
                detail.getId(),
                detail.getPerformanceNum(),
                detail.getPerformanceDate(),
                detail.getStatus(),
                bookingStatus,
                bookingStatus == BookingOpenStatus.OPEN,
                // 취소 마감은 공연 시작 − booking.policy.cancel-deadline-lead
                detail.getPerformanceDate().minus(cancelDeadlineLead),
                performance.getId(),
                performance.getTitle(),
                performance.getStadium().getName(),
                performance.getTicketingStartAt()
        );
    }
}
