package com.teacat.server.stadium.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.stadium.dto.response.AreaDetailResponse;
import com.teacat.server.stadium.dto.response.AreaListResponse;
import com.teacat.server.stadium.dto.response.SeatListResponse;
import com.teacat.server.stadium.dto.response.StadiumListResponse;
import com.teacat.server.stadium.dto.response.StadiumResponse;
import com.teacat.server.stadium.service.StadiumService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "공연장", description = "공연장·구역·좌석 조회 API")
@RestController
@RequiredArgsConstructor
@Validated
public class StadiumController {

    private final StadiumService stadiumService;

    @Operation(summary = "공연장 목록 조회")
    @GetMapping("/stadiums")
    public ResponseEntity<BaseResponse<StadiumListResponse>> getStadiums() {
        return ResponseEntity.ok(BaseResponse.success(stadiumService.getStadiums()));
    }

    @Operation(summary = "공연장 상세 조회")
    @GetMapping("/stadiums/{stadiumId}")
    public ResponseEntity<BaseResponse<StadiumResponse>> getStadium(
            @Parameter(description = "공연장 ID", example = "1")
            @PathVariable @Positive Long stadiumId) {
        return ResponseEntity.ok(BaseResponse.success(stadiumService.getStadium(stadiumId)));
    }

    @Operation(summary = "공연장 구역 목록 조회")
    @GetMapping("/stadiums/{stadiumId}/areas")
    public ResponseEntity<BaseResponse<AreaListResponse>> getAreas(
            @Parameter(description = "공연장 ID", example = "1")
            @PathVariable @Positive Long stadiumId) {
        return ResponseEntity.ok(BaseResponse.success(stadiumService.getAreas(stadiumId)));
    }

    @Operation(summary = "공연장 구역 상세 조회")
    @GetMapping("/areas/{areaId}")
    public ResponseEntity<BaseResponse<AreaDetailResponse>> getArea(
            @Parameter(description = "구역 ID", example = "10")
            @PathVariable @Positive Long areaId) {
        return ResponseEntity.ok(BaseResponse.success(stadiumService.getArea(areaId)));
    }

    @Operation(summary = "구역별 좌석 목록 조회")
    @GetMapping("/areas/{areaId}/seats")
    public ResponseEntity<BaseResponse<SeatListResponse>> getSeats(
            @Parameter(description = "구역 ID", example = "10")
            @PathVariable @Positive Long areaId) {
        return ResponseEntity.ok(BaseResponse.success(stadiumService.getSeats(areaId)));
    }
}
