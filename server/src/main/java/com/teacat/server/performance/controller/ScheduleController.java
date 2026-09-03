package com.teacat.server.performance.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.performance.dto.response.BookingStatusResponse;
import com.teacat.server.performance.dto.response.ScheduleDetailResponse;
import com.teacat.server.performance.service.ScheduleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "공연 회차", description = "회차 조회 API")
@RestController
@RequestMapping("/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;

    @Operation(summary = "회차 단건 조회",
            description = "예매 화면에 필요한 회차 요약(공연명·공연장·예매 가능 여부·취소 마감)을 조회합니다.")
    @GetMapping("/{scheduleId}")
    public ResponseEntity<BaseResponse<ScheduleDetailResponse>> getSchedule(
            @Parameter(description = "회차 ID", example = "1") @PathVariable Long scheduleId) {
        return ResponseEntity.ok(BaseResponse.success(scheduleService.getSchedule(scheduleId)));
    }

    @Operation(summary = "예매 오픈 상태 · 서버 시각 조회",
            description = "서버 기준 현재 시각과 오픈 상태(BEFORE/OPEN/SOLDOUT/CLOSED)를 조회합니다. "
                    + "클라이언트 시계가 서버와 어긋나도 카운트다운이 틀리지 않도록 서버 시각을 함께 내려줍니다.")
    @GetMapping("/{scheduleId}/booking-status")
    public ResponseEntity<BaseResponse<BookingStatusResponse>> getBookingStatus(
            @Parameter(description = "회차 ID", example = "1") @PathVariable Long scheduleId) {
        return ResponseEntity.ok(BaseResponse.success(scheduleService.getBookingStatus(scheduleId)));
    }
}
