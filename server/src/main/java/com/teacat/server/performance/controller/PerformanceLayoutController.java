package com.teacat.server.performance.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.performance.dto.response.PerformanceLayoutResponse;
import com.teacat.server.performance.service.PerformanceLayoutService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "공연별 배치", description = "공연에 적용된 좌석 배치와 무대·차단 좌석 조회 API")
@RestController
@RequiredArgsConstructor
@Validated
public class PerformanceLayoutController {

    private final PerformanceLayoutService performanceLayoutService;

    @Operation(summary = "공연 배치 조회")
    @GetMapping("/performances/{performanceId}/layout")
    public ResponseEntity<BaseResponse<PerformanceLayoutResponse>> getLayout(
            @PathVariable @Positive Long performanceId) {
        return ResponseEntity.ok(BaseResponse.success(performanceLayoutService.getLayout(performanceId)));
    }
}
