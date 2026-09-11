package com.teacat.server.analytics.controller;

import com.teacat.server.analytics.dto.response.MemberSummaryResponse;
import com.teacat.server.analytics.dto.response.MemberTrendResponse;
import com.teacat.server.analytics.service.AdminAnalyticsService;
import com.teacat.server.common.response.BaseResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 어드민 대시보드 통계 API.
 *
 * <p>{@code /admin/**} 은 {@code SecurityConfig} 에서 ADMIN 전용이다.
 *
 * <p>🔴 기간은 시작일·종료일이 아니라 <b>일수</b>로 받는다. 브라우저의 "오늘" 은
 * 사용자의 시간대라, 해외에 있거나 시계가 어긋난 PC 에서 열면 서버가 아는 오늘과
 * 하루 차이가 난다. 오늘이 언제인지는 서버가 정한다.
 */
@Tag(name = "운영 통계", description = "어드민 대시보드용 회원 지표 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/analytics")
@RequiredArgsConstructor
public class AdminAnalyticsController {

    private final AdminAnalyticsService adminAnalyticsService;

    @Operation(summary = "회원 지표 요약",
            description = "대시보드 카드 숫자입니다. 접속자 관련 값은 집계를 시작한 뒤부터 쌓입니다 "
                    + "(activeUsersTrackedFrom 이 그 날짜이고, 기록이 없으면 null).")
    @GetMapping("/members/summary")
    public ResponseEntity<BaseResponse<MemberSummaryResponse>> summary() {
        return ResponseEntity.ok(BaseResponse.success(adminAnalyticsService.summary()));
    }

    @Operation(summary = "회원 추이",
            description = "일자별 가입·탈퇴·접속자·누적 회원과 그 기간의 운영 배포 마커입니다. "
                    + "빠진 날짜 없이 오늘까지 days 일이 모두 들어 있습니다.")
    @GetMapping("/members")
    public ResponseEntity<BaseResponse<MemberTrendResponse>> trend(
            @Parameter(description = "오늘을 포함한 조회 일수 (2~365)", example = "30")
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(BaseResponse.success(adminAnalyticsService.trend(days)));
    }
}
