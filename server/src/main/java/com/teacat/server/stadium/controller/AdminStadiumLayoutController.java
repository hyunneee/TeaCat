package com.teacat.server.stadium.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.stadium.dto.request.StadiumLayoutCreateRequest;
import com.teacat.server.stadium.dto.request.StadiumLayoutCopyRequest;
import com.teacat.server.stadium.dto.request.StadiumLayoutUpdateRequest;
import com.teacat.server.stadium.dto.response.ExcelAnalysisResponse;
import com.teacat.server.stadium.dto.response.StadiumLayoutCreateResponse;
import com.teacat.server.stadium.service.StadiumLayoutService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "공연장 배치 관리", description = "Excel 분석과 공연장 배치 관리 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequiredArgsConstructor
@Validated
public class AdminStadiumLayoutController {

    private final StadiumLayoutService stadiumLayoutService;

    @Operation(summary = "Excel 좌석표 분석", description = "DB에 저장하지 않고 분석 결과를 Redis에 30분간 보관합니다.")
    @PostMapping(value = "/admin/stadiums/{stadiumId}/layout-imports/excel",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BaseResponse<ExcelAnalysisResponse>> analyzeExcel(
            @PathVariable @Positive Long stadiumId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(BaseResponse.success(
                "Excel 좌석표 분석이 완료되었습니다.",
                stadiumLayoutService.analyzeExcel(stadiumId, authUser, file)));
    }

    @Operation(summary = "Excel 분석 결과로 공연장 배치 확정")
    @PostMapping("/admin/stadiums/{stadiumId}/layouts")
    public ResponseEntity<BaseResponse<StadiumLayoutCreateResponse>> createLayout(
            @PathVariable @Positive Long stadiumId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody StadiumLayoutCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(BaseResponse.success(
                "공연장 배치와 좌석이 저장되었습니다.",
                stadiumLayoutService.createFromExcel(stadiumId, authUser, request)));
    }

    @Operation(summary = "기존 공연장 배치 복제", description = "구역·좌석·층·고정 요소를 새 DRAFT 배치로 복제합니다.")
    @PostMapping("/admin/stadium-layouts/{layoutId}/copies")
    public ResponseEntity<BaseResponse<StadiumLayoutCreateResponse>> copyLayout(
            @PathVariable @Positive Long layoutId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody StadiumLayoutCopyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(BaseResponse.success(
                "공연장 배치가 복제되었습니다.",
                stadiumLayoutService.copyLayout(layoutId, authUser, request)));
    }

    @Operation(summary = "공연장 배치 정보 수정")
    @PatchMapping("/admin/stadium-layouts/{layoutId}")
    public ResponseEntity<BaseResponse<Void>> updateLayout(
            @PathVariable @Positive Long layoutId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody StadiumLayoutUpdateRequest request) {
        stadiumLayoutService.updateLayout(layoutId, authUser, request);
        return ResponseEntity.ok(BaseResponse.success("공연장 배치가 수정되었습니다."));
    }

    @Operation(summary = "공연장 배치 삭제")
    @DeleteMapping("/admin/stadium-layouts/{layoutId}")
    public ResponseEntity<BaseResponse<Void>> deleteLayout(
            @PathVariable @Positive Long layoutId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        stadiumLayoutService.deleteLayout(layoutId, authUser);
        return ResponseEntity.ok(BaseResponse.success("공연장 배치가 삭제되었습니다."));
    }
}
