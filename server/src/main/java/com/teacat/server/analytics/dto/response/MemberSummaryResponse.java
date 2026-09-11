package com.teacat.server.analytics.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

/**
 * 대시보드 상단 숫자 카드.
 *
 * <p>비율(전환율·재방문율)은 내려주지 않는다. 분자와 분모를 모두 주고 화면이 계산한다 —
 * 반올림 자리수를 서버와 프론트가 각자 정하면 카드와 툴팁의 숫자가 달라진다.
 *
 * <p>운영진 계정(ADMIN·STADIUM·PERFORMANCE)은 전부 제외한 값이다.
 */
@Schema(description = "회원 지표 요약")
public record MemberSummaryResponse(

        @Schema(description = "현재 일반 회원 수 (탈퇴 제외)", example = "137")
        long totalMembers,

        @Schema(description = "그중 얼굴 등록을 마친 회원 수", example = "88")
        long faceRegistered,

        @Schema(description = "최근 7일 신규 가입", example = "12")
        long signupsLast7Days,

        @Schema(description = "최근 7일 탈퇴", example = "1")
        long withdrawalsLast7Days,

        @Schema(description = "오늘 접속자", example = "34")
        long activeToday,

        @Schema(description = "어제 접속자. 오늘과 비교해 증감을 보여준다", example = "29")
        long activeYesterday,

        @Schema(description = "최근 7일 순 접속자 (WAU)", example = "96")
        long weeklyActiveUsers,

        @Schema(description = "최근 30일 순 접속자 (MAU)", example = "121")
        long monthlyActiveUsers,

        @Schema(description = "최근 7일 접속자 중 그 이전에도 온 적이 있는 사람 수. "
                + "weeklyActiveUsers 로 나누면 재방문율", example = "61")
        long weeklyReturningUsers,

        @Schema(description = "접속자 집계가 시작된 날. 기록이 없으면 null", example = "2026-09-09")
        LocalDate activeUsersTrackedFrom
) {
}
