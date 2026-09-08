package com.teacat.server.performance.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.performance.dto.request.PerformanceLayoutUpdateRequest;
import com.teacat.server.performance.dto.response.PerformanceLayoutResponse;
import com.teacat.server.performance.service.PerformanceLayoutService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "공연별 배치 관리", description = "공연의 무대 요소와 차단 좌석 관리 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequiredArgsConstructor
@Validated
public class AdminPerformanceLayoutController {

    private final PerformanceLayoutService performanceLayoutService;

    @Operation(summary = "공연 배치 저장")
    @PutMapping("/admin/performances/{performanceId}/layout")
    public ResponseEntity<BaseResponse<PerformanceLayoutResponse>> updateLayout(
            @PathVariable @Positive Long performanceId,
            @Valid @RequestBody PerformanceLayoutUpdateRequest request) {
        return ResponseEntity.ok(BaseResponse.success(
                "공연 배치가 저장되었습니다.",
                performanceLayoutService.updateLayout(performanceId, request)));
    }
}
