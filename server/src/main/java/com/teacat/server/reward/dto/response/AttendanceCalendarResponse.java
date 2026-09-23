package com.teacat.server.reward.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.List;

/**
 * 한 달치 출석 기록.
 *
 * <p>🔴 날짜는 <b>서버(Asia/Seoul) 기준</b>이다. 화면이 기기 시계로 "오늘" 을 정하면
 * 자정 근처에서 도장이 하루 어긋나 보인다 — 받은 날은 서버가 정하고 화면은 그대로 그린다.
 *
 * @param month      조회한 달의 1일
 * @param days       그달에 출석한 날들 (오름차순)
 * @param totalDays  그달에 출석한 일수
 * @param totalAmount 그달에 출석으로 받은 캣머니 합계
 * @param streak     오늘 기준 연속 출석 일수
 * @param today      서버가 보는 오늘. 화면이 "오늘" 칸을 표시할 때 쓴다
 */
@Schema(description = "출석 달력")
public record AttendanceCalendarResponse(

        @Schema(description = "조회한 달의 1일", example = "2026-09-01")
        LocalDate month,

        @Schema(description = "출석한 날들", example = "[\"2026-09-01\", \"2026-09-02\"]")
        List<AttendanceDayResponse> days,

        @Schema(description = "그달 출석 일수", example = "12")
        int totalDays,

        @Schema(description = "그달에 출석으로 받은 캣머니 합계", example = "6000")
        long totalAmount,

        @Schema(description = "오늘 기준 연속 출석 일수", example = "3")
        long streak,

        @Schema(description = "서버(Asia/Seoul)가 보는 오늘", example = "2026-09-22")
        LocalDate today) {

    @Schema(description = "출석한 하루")
    public record AttendanceDayResponse(

            @Schema(description = "받은 날", example = "2026-09-22")
            LocalDate date,

            @Schema(description = "그날 받은 금액. 금액이 바뀌어도 예전 기록은 그때 값이다", example = "500")
            long amount) {
    }
}
