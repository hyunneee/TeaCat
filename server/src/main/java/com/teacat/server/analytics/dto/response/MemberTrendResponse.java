package com.teacat.server.analytics.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.List;

/**
 * 회원 추이 차트 한 벌 — 점들 + 배포 마커.
 *
 * <p>차트 하나에 필요한 것을 한 번에 내려준다. 프론트가 점과 마커를 따로 불러
 * 두 응답의 기간이 어긋나면 마커가 축 밖에 찍힌다.
 */
@Schema(description = "회원 추이")
public record MemberTrendResponse(

        @Schema(description = "조회 시작일", example = "2026-08-11")
        LocalDate from,

        @Schema(description = "조회 종료일 (포함)", example = "2026-09-09")
        LocalDate to,

        @Schema(description = "일자별 지표. 빠진 날짜 없이 from~to 전부 들어 있다")
        List<MemberDailyPoint> points,

        @Schema(description = "접속자 집계가 시작된 날. 이 날짜 이전의 activeUsers 는 "
                + "0 이 아니라 '잰 적 없음' 이다. 기록이 아예 없으면 null",
                example = "2026-09-09")
        LocalDate activeUsersTrackedFrom,

        @Schema(description = "기간에 걸친 운영 배포. 시간순")
        List<DeploymentMarkerResponse> deployments
) {
}
