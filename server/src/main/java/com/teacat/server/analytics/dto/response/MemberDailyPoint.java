package com.teacat.server.analytics.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

/**
 * 꺾은선 한 점. 구간 안의 <b>모든</b> 날짜가 들어 있다 (아무 일도 없던 날은 0).
 *
 * <p>비어 있는 날을 빼고 보내면 프론트가 x 축 간격을 직접 메워야 하고,
 * 그걸 잊으면 이틀 쉬었다 하루 오른 그래프가 하루 만에 오른 것처럼 보인다.
 */
@Schema(description = "일자별 회원 지표 한 점")
public record MemberDailyPoint(

        @Schema(description = "날짜", example = "2026-09-09")
        LocalDate date,

        @Schema(description = "그날 가입한 회원 수", example = "12")
        long signups,

        @Schema(description = "그날 탈퇴한 회원 수", example = "1")
        long withdrawals,

        @Schema(description = "그날 접속한 회원 수 (한 사람당 하루 1). "
                + "집계 시작일 이전은 잰 적이 없어 0 이다 — trackedFrom 을 보고 구분한다", example = "34")
        long activeUsers,

        @Schema(description = "그날 자정 기준 누적 회원 수 (탈퇴 제외)", example = "137")
        long totalMembers
) {
}
