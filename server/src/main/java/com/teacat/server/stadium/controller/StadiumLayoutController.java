package com.teacat.server.stadium.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.stadium.dto.response.AreaListResponse;
import com.teacat.server.stadium.dto.response.StadiumLayoutDetailResponse;
import com.teacat.server.stadium.dto.response.StadiumLayoutListResponse;
import com.teacat.server.stadium.service.StadiumLayoutService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "공연장 배치", description = "공연장별 재사용 가능한 구역·좌석 배치 조회 API")
@RestController
@RequiredArgsConstructor
@Validated
public class StadiumLayoutController {

    private final StadiumLayoutService stadiumLayoutService;

    @Operation(summary = "공연장 배치 목록 조회")
    @GetMapping("/stadiums/{stadiumId}/layouts")
    public ResponseEntity<BaseResponse<StadiumLayoutListResponse>> getLayouts(
            @PathVariable @Positive Long stadiumId) {
        return ResponseEntity.ok(BaseResponse.success(stadiumLayoutService.getLayouts(stadiumId)));
    }

    @Operation(summary = "공연장 배치 상세 조회")
    @GetMapping("/stadium-layouts/{layoutId}")
    public ResponseEntity<BaseResponse<StadiumLayoutDetailResponse>> getLayout(
            @PathVariable @Positive Long layoutId) {
        return ResponseEntity.ok(BaseResponse.success(stadiumLayoutService.getLayout(layoutId)));
    }

    @Operation(summary = "배치별 구역 목록 조회")
    @GetMapping("/stadium-layouts/{layoutId}/areas")
    public ResponseEntity<BaseResponse<AreaListResponse>> getAreas(
            @PathVariable @Positive Long layoutId) {
        return ResponseEntity.ok(BaseResponse.success(stadiumLayoutService.getAreas(layoutId)));
    }
}
