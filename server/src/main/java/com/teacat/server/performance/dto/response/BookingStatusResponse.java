package com.teacat.server.performance.dto.response;

import com.teacat.server.performance.entity.BookingOpenStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 예매 오픈 상태 · 서버 시각 응답 (API-206).
 *
 * 클라이언트 시계가 서버와 어긋나도 카운트다운이 틀리지 않게 서버 시각을 함께 준다.
 */
@Schema(description = "예매 오픈 상태 응답")
public record BookingStatusResponse(

        @Schema(description = "회차 ID", example = "1")
        Long scheduleId,

        @Schema(description = "오픈 상태", example = "BEFORE")
        BookingOpenStatus status,

        @Schema(description = "티켓팅 오픈 시각")
        LocalDateTime ticketingStartAt,

        @Schema(description = "응답을 만든 시점의 서버 시각. 카운트다운의 기준으로 쓴다")
        LocalDateTime serverTime,

        @Schema(description = "오픈까지 남은 초. 이미 열렸거나 끝났으면 0", example = "3600")
        long secondsUntilOpen
) {
}
