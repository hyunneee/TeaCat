package com.teacat.server.performance.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.performance.dto.response.BookingPolicyResponse;
import com.teacat.server.performance.dto.response.PerformanceAreaResponse;
import com.teacat.server.performance.dto.response.ConcertDetailResponse;
import com.teacat.server.performance.dto.response.ConcertListResponse;
import com.teacat.server.performance.dto.response.ConcertSummaryResponse;
import com.teacat.server.performance.dto.response.ScheduleSummaryResponse;
import com.teacat.server.performance.dto.response.PerformanceViewResponse;
import com.teacat.server.performance.service.PerformanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "공연", description = "공연 조회 API")
@RestController
@RequestMapping("/concerts")
@RequiredArgsConstructor
@Validated
public class PerformanceController {

    private final PerformanceService performanceService;

    @Operation(summary = "공연 목록 조회",
            description = """
                    노출 시작일이 지난 공연을 최신순으로 조회합니다. 다음 페이지는 응답의
                    nextCursor 를 cursor 로 넘겨 요청합니다.

                    - `past=false`(기본)는 **남은 회차가 있는 공연**, `past=true` 는 회차가 전부
                      지난 공연입니다. 두 목록은 겹치지 않습니다.
                    - 각 항목의 `bookingStatus` 는 회차를 합쳐 서버가 계산한 대표 예매 상태입니다.
                      **목록 칩은 이 값을 쓰세요** — `ticketingStartAt` 만 보면 회차가 전부 마감된
                      공연도 "예매중" 으로 보입니다.
                    """)
    @GetMapping
    public ResponseEntity<BaseResponse<ConcertListResponse>> getConcerts(
            @Parameter(description = "검색어 (공연 제목 부분 일치)", example = "콘서트")
            @RequestParam(required = false) String keyword,

            @Parameter(description = "회차가 전부 지난 공연만 조회", example = "false")
            @RequestParam(defaultValue = "false") boolean past,

            @Parameter(description = "이전 응답의 nextCursor. 첫 페이지는 생략", example = "12")
            @RequestParam(required = false) Long cursor,

            @Parameter(description = "한 번에 가져올 개수 (1~50)", example = "20")
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) {
        return ResponseEntity.ok(
                BaseResponse.success(performanceService.getConcerts(keyword, past, cursor, size)));
    }

    @Operation(summary = "오픈 예정 공연 목록 조회",
            description = "노출은 시작됐지만 티켓팅이 아직 열리지 않은 공연을 오픈 임박 순으로 조회합니다. (메인 티켓 오픈 예정 섹션)")
    @GetMapping("/upcoming-open")
    public ResponseEntity<BaseResponse<List<ConcertSummaryResponse>>> getUpcomingOpenConcerts(
            @Parameter(description = "가져올 개수 (1~50)", example = "10")
            @RequestParam(defaultValue = "10") @Min(1) @Max(50) int size) {
        return ResponseEntity.ok(BaseResponse.success(performanceService.getUpcomingOpenConcerts(size)));
    }

    @Operation(summary = "공연 상세 조회", description = "공연장 정보와 회차 목록을 함께 조회합니다.")
    @GetMapping("/{concertId}")
    public ResponseEntity<BaseResponse<ConcertDetailResponse>> getConcert(
            @Parameter(description = "공연 ID", example = "1") @PathVariable Long concertId) {
        return ResponseEntity.ok(BaseResponse.success(performanceService.getConcert(concertId)));
    }

    @PostMapping("/{concertId}/views")
    public ResponseEntity<BaseResponse<PerformanceViewResponse>> recordView(
            @PathVariable Long concertId,
            @RequestHeader("X-View-Session") String sessionId) {
        return ResponseEntity.ok(BaseResponse.success(performanceService.recordView(concertId, sessionId)));
    }

    @Operation(summary = "공연 회차 목록 조회", description = "공연의 회차 목록과 회차별 예매 가능 여부를 조회합니다.")
    @GetMapping("/{concertId}/schedules")
    public ResponseEntity<BaseResponse<List<ScheduleSummaryResponse>>> getSchedules(
            @Parameter(description = "공연 ID", example = "1") @PathVariable Long concertId) {
        return ResponseEntity.ok(BaseResponse.success(performanceService.getSchedules(concertId)));
    }

    @Operation(summary = "공연 예매 정책 조회",
            description = "1인 최대 매수 · 동행 지정 필수 여부 · 얼굴 인증 필요 여부 · 취소 마감 규칙을 조회합니다.")
    @GetMapping("/{concertId}/policy")
    public ResponseEntity<BaseResponse<BookingPolicyResponse>> getBookingPolicy(
            @Parameter(description = "공연 ID", example = "1") @PathVariable Long concertId) {
        return ResponseEntity.ok(BaseResponse.success(performanceService.getBookingPolicy(concertId)));
    }

    @Operation(summary = "공연 구역 등급·가격 조회",
            description = """
                    구역 선택 화면이 쓰는 값입니다. 구역별 등급·가격과 판매 수량을 조회합니다.

                    - `grade` 와 `price` 는 **null 일 수 있습니다** — 구역만 만들고 등급·가격을
                      아직 설정하지 않은 상태입니다. 가격이 없으면 결제 금액을 정할 수 없으므로
                      클라이언트는 그 구역을 예매 불가로 처리해야 합니다.
                    - 좌석 좌표까지 함께 필요하면 `GET /schedules/{scheduleId}/seats` 를 쓰세요.
                      이 API 는 좌석 없이 구역만 보여주는 화면을 위한 가벼운 응답입니다.
                    """)
    @GetMapping("/{concertId}/areas")
    public ResponseEntity<BaseResponse<List<PerformanceAreaResponse>>> getAreas(
            @Parameter(description = "공연 ID", example = "1") @PathVariable Long concertId) {
        return ResponseEntity.ok(BaseResponse.success(performanceService.getAreas(concertId)));
    }
}
