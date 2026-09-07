package com.teacat.server.performance.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.performance.dto.request.ScheduleUpdateRequest;
import com.teacat.server.performance.dto.response.SeatGenerateResponse;
import com.teacat.server.performance.service.AdminScheduleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 회차는 공연에 속하므로, 그 공연을 등록한 관리자만 다룰 수 있다. 남의 공연 회차는 PERFORMANCE_020(403).
 */
@Tag(name = "공연 회차 관리", description = "관리자용 회차 수정·삭제·좌석 생성 API. 본인이 등록한 공연의 회차만 관리할 수 있습니다.")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/schedules")
@RequiredArgsConstructor
public class AdminScheduleController {

    private final AdminScheduleService adminScheduleService;

    @Operation(summary = "회차 수정", description = "공연 일시와 판매 상태를 수정합니다. 보낸 필드만 변경됩니다.")
    @PatchMapping("/{scheduleId}")
    public ResponseEntity<BaseResponse<Void>> update(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "회차 ID", example = "1") @PathVariable Long scheduleId,
            @Valid @RequestBody ScheduleUpdateRequest request) {
        adminScheduleService.update(scheduleId, request, authUser.id());
        return ResponseEntity.ok(BaseResponse.success("회차 정보가 수정되었습니다."));
    }

    @Operation(summary = "회차 삭제", description = "예매 이력이 없는 회차만 삭제할 수 있습니다.")
    @DeleteMapping("/{scheduleId}")
    public ResponseEntity<Void> delete(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "회차 ID", example = "1") @PathVariable Long scheduleId) {
        adminScheduleService.delete(scheduleId, authUser.id());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "회차 좌석 생성",
            description = "공연 구역 설정(API-268)에서 판매하기로 한 좌석제 구역의 좌석을 일괄 생성합니다. "
                    + "이 API 를 돌리지 않으면 좌석 조회가 읽을 데이터가 없습니다.")
    @PostMapping("/{scheduleId}/seats")
    public ResponseEntity<BaseResponse<SeatGenerateResponse>> generateSeats(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "회차 ID", example = "1") @PathVariable Long scheduleId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success("좌석이 생성되었습니다.",
                        adminScheduleService.generateSeats(scheduleId, authUser.id())));
    }
}
