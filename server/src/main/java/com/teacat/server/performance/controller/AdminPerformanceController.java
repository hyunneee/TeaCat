package com.teacat.server.performance.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.performance.dto.request.ConcertCreateRequest;
import com.teacat.server.performance.dto.request.ConcertStatusRequest;
import com.teacat.server.performance.dto.request.ConcertUpdateRequest;
import com.teacat.server.performance.dto.request.ConcertVisibilityRequest;
import com.teacat.server.performance.dto.request.PerformanceAreaSaveRequest;
import com.teacat.server.performance.dto.request.ScheduleCreateRequest;
import com.teacat.server.performance.dto.response.ConcertCreateResponse;
import com.teacat.server.performance.dto.response.ConcertStatusResponse;
import com.teacat.server.performance.dto.response.ConcertVisibilityResponse;
import com.teacat.server.performance.dto.response.PerformanceAreaResponse;
import com.teacat.server.performance.dto.response.ScheduleCreateResponse;
import com.teacat.server.performance.service.AdminPerformanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 등록을 뺀 모든 API 는 본인이 등록한 공연에만 동작한다. 남의 공연은 PERFORMANCE_020(403).
 */
@Tag(name = "공연 관리", description = "관리자용 공연 등록·수정·삭제 API. 본인이 등록한 공연만 관리할 수 있습니다.")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/concerts")
@RequiredArgsConstructor
public class AdminPerformanceController {

    private final AdminPerformanceService adminPerformanceService;

    @Operation(summary = "공연 등록",
            description = "공연을 등록합니다. 포스터·상세 이미지를 함께 올리면 MinIO 에 저장되고 DB 에는 저장 경로만 남습니다. "
                    + "등록한 관리자가 이 공연의 관리자가 됩니다.")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BaseResponse<ConcertCreateResponse>> create(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @ModelAttribute ConcertCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success("공연이 등록되었습니다.",
                        adminPerformanceService.create(request, authUser.id())));
    }

    @Operation(summary = "공연 수정",
            description = "보낸 필드만 변경합니다. 티켓팅이 시작된 뒤에는 제목만 변경할 수 있습니다.")
    @PatchMapping("/{concertId}")
    public ResponseEntity<BaseResponse<Void>> update(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "공연 ID", example = "1") @PathVariable Long concertId,
            @Valid @RequestBody ConcertUpdateRequest request) {
        adminPerformanceService.update(concertId, request, authUser.id());
        return ResponseEntity.ok(BaseResponse.success("공연 정보가 수정되었습니다."));
    }

    @Operation(summary = "회차 등록",
            description = "공연에 회차를 추가합니다. 회차 번호를 생략하면 다음 번호가 자동으로 붙습니다.")
    @PostMapping("/{concertId}/schedules")
    public ResponseEntity<BaseResponse<ScheduleCreateResponse>> createSchedule(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "공연 ID", example = "1") @PathVariable Long concertId,
            @Valid @RequestBody ScheduleCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success("회차가 등록되었습니다.",
                        adminPerformanceService.createSchedule(concertId, request, authUser.id())));
    }

    @Operation(summary = "공연 구역 등급·가격 설정",
            description = "공연장 구역에 등급·가격·최대 판매수량을 매깁니다. "
                    + "보낸 목록이 전체가 되며, 빠진 구역은 판매하지 않는 것으로 보고 삭제됩니다.")
    @PutMapping("/{concertId}/areas")
    public ResponseEntity<BaseResponse<List<PerformanceAreaResponse>>> saveAreas(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "공연 ID", example = "1") @PathVariable Long concertId,
            @Valid @RequestBody PerformanceAreaSaveRequest request) {
        return ResponseEntity.ok(BaseResponse.success("공연 구역 설정이 저장되었습니다.",
                adminPerformanceService.saveAreas(concertId, request, authUser.id())));
    }

    @Operation(summary = "공연 상태 전환",
            description = "공연 진행 상태를 바꿉니다. UPCOMING → ONGOING → ENDED 순서로만 나아갈 수 있고, "
                    + "UPCOMING·ONGOING 은 CANCELLED 로 바꿀 수 있습니다. 종료·취소된 공연은 되돌릴 수 없습니다.")
    @PatchMapping("/{concertId}/status")
    public ResponseEntity<BaseResponse<ConcertStatusResponse>> changeStatus(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "공연 ID", example = "1") @PathVariable Long concertId,
            @Valid @RequestBody ConcertStatusRequest request) {
        return ResponseEntity.ok(BaseResponse.success("공연 상태가 변경되었습니다.",
                adminPerformanceService.changeStatus(concertId, request.status(), authUser.id())));
    }

    @Operation(summary = "공연 노출 전환",
            description = "공연을 공개하거나 비공개로 감춥니다. 예매 이력과 무관하게 언제든 전환할 수 있고, "
                    + "비공개는 목록·상세에서 감출 뿐 데이터를 지우지 않아 되돌릴 수 있습니다.")
    @PatchMapping("/{concertId}/visibility")
    public ResponseEntity<BaseResponse<ConcertVisibilityResponse>> setVisibility(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "공연 ID", example = "1") @PathVariable Long concertId,
            @Valid @RequestBody ConcertVisibilityRequest request) {
        return ResponseEntity.ok(BaseResponse.success(
                adminPerformanceService.setVisibility(concertId, request.visible(), authUser.id())));
    }

    @Operation(summary = "공연 삭제",
            description = "공연을 완전히 지웁니다. 예매 이력이 있으면 거절되므로, "
                    + "그럴 때는 노출 전환으로 비공개 처리하세요.")
    @DeleteMapping("/{concertId}")
    public ResponseEntity<Void> delete(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "공연 ID", example = "1") @PathVariable Long concertId) {
        adminPerformanceService.delete(concertId, authUser.id());
        return ResponseEntity.noContent().build();
    }
}
