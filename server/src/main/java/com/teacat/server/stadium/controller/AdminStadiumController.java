package com.teacat.server.stadium.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.stadium.dto.request.AreaBatchCreateRequest;
import com.teacat.server.stadium.dto.request.AreaUpdateRequest;
import com.teacat.server.stadium.dto.request.SeatBatchCreateRequest;
import com.teacat.server.stadium.dto.request.SeatUpdateRequest;
import com.teacat.server.stadium.dto.request.StadiumCreateRequest;
import com.teacat.server.stadium.dto.request.StadiumUpdateRequest;
import com.teacat.server.stadium.dto.response.AreaBulkCreateResponse;
import com.teacat.server.stadium.dto.response.SeatBulkCreateResponse;
import com.teacat.server.stadium.dto.response.StadiumCreateResponse;
import com.teacat.server.stadium.dto.response.StadiumLayoutImageResponse;
import com.teacat.server.stadium.service.StadiumService;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "공연장 관리", description = "공연장·구역·좌석 관리 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequiredArgsConstructor
@Validated
public class AdminStadiumController {

    private final StadiumService stadiumService;

    @Operation(summary = "공연장 등록", description = "STADIUM 역할은 자신을 관리자로 지정하고 ADMIN 역할은 미배정 상태로 생성합니다.")
    @PostMapping("/admin/stadiums")
    public ResponseEntity<BaseResponse<StadiumCreateResponse>> createStadium(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody StadiumCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success("공연장이 등록되었습니다.",
                        stadiumService.createStadium(authUser, request)));
    }

    @Operation(summary = "공연장 수정")
    @PatchMapping("/admin/stadiums/{stadiumId}")
    public ResponseEntity<BaseResponse<Void>> updateStadium(
            @Parameter(description = "공연장 ID", example = "1") @PathVariable @Positive Long stadiumId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody StadiumUpdateRequest request) {
        stadiumService.updateStadium(stadiumId, authUser, request);
        return ResponseEntity.ok(BaseResponse.success("공연장 정보가 수정되었습니다."));
    }

    @Operation(summary = "공연장 삭제")
    @DeleteMapping("/admin/stadiums/{stadiumId}")
    public ResponseEntity<BaseResponse<Void>> deleteStadium(
            @Parameter(description = "공연장 ID", example = "1") @PathVariable @Positive Long stadiumId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        stadiumService.deleteStadium(stadiumId, authUser);
        return ResponseEntity.ok(BaseResponse.success("공연장이 삭제되었습니다."));
    }

    @Operation(summary = "좌석표 이미지 등록·교체",
            description = "JPG 또는 PNG 좌석표를 MinIO에 저장하고 원본 이미지 크기를 좌표계로 기록합니다.")
    @PutMapping(value = "/admin/stadiums/{stadiumId}/layout-image",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BaseResponse<StadiumLayoutImageResponse>> updateLayoutImage(
            @Parameter(description = "공연장 ID", example = "1") @PathVariable @Positive Long stadiumId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @RequestPart("image") MultipartFile image) {
        return ResponseEntity.ok(BaseResponse.success("좌석표 이미지가 저장되었습니다.",
                stadiumService.updateLayoutImage(stadiumId, authUser, image)));
    }

    @Operation(summary = "좌석표 이미지 삭제",
            description = "공연장·구역·좌석은 유지하고 좌석표 이미지 연결만 삭제합니다.")
    @DeleteMapping("/admin/stadiums/{stadiumId}/layout-image")
    public ResponseEntity<BaseResponse<Void>> deleteLayoutImage(
            @Parameter(description = "공연장 ID", example = "1") @PathVariable @Positive Long stadiumId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        stadiumService.deleteLayoutImage(stadiumId, authUser);
        return ResponseEntity.ok(BaseResponse.success("좌석표 이미지가 삭제되었습니다."));
    }

    @Operation(summary = "구역과 초기 좌석 일괄 생성", description = "모든 구역과 좌석을 하나의 트랜잭션에서 생성합니다.")
    @PostMapping("/admin/stadiums/{stadiumId}/areas")
    public ResponseEntity<BaseResponse<AreaBulkCreateResponse>> createAreas(
            @Parameter(description = "공연장 ID", example = "1") @PathVariable @Positive Long stadiumId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody AreaBatchCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success("구역과 좌석이 등록되었습니다.",
                        stadiumService.createAreas(stadiumId, authUser, request)));
    }

    @Operation(summary = "공연장 구역 수정")
    @PatchMapping("/admin/areas/{areaId}")
    public ResponseEntity<BaseResponse<Void>> updateArea(
            @Parameter(description = "구역 ID", example = "10") @PathVariable @Positive Long areaId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody AreaUpdateRequest request) {
        stadiumService.updateArea(areaId, authUser, request);
        return ResponseEntity.ok(BaseResponse.success("구역 정보가 수정되었습니다."));
    }

    @Operation(summary = "공연장 구역 삭제")
    @DeleteMapping("/admin/areas/{areaId}")
    public ResponseEntity<BaseResponse<Void>> deleteArea(
            @Parameter(description = "구역 ID", example = "10") @PathVariable @Positive Long areaId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        stadiumService.deleteArea(areaId, authUser);
        return ResponseEntity.ok(BaseResponse.success("구역이 삭제되었습니다."));
    }

    @Operation(summary = "좌석 일괄 생성", description = "구역에 여러 좌석을 하나의 트랜잭션으로 생성합니다.")
    @PostMapping("/admin/areas/{areaId}/seats")
    public ResponseEntity<BaseResponse<SeatBulkCreateResponse>> createSeats(
            @Parameter(description = "구역 ID", example = "10") @PathVariable @Positive Long areaId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody SeatBatchCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success("좌석이 등록되었습니다.",
                        stadiumService.createSeats(areaId, authUser, request)));
    }

    @Operation(summary = "좌석 수정")
    @PatchMapping("/admin/seats/{seatId}")
    public ResponseEntity<BaseResponse<Void>> updateSeat(
            @Parameter(description = "좌석 ID", example = "1001") @PathVariable @Positive Long seatId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody SeatUpdateRequest request) {
        stadiumService.updateSeat(seatId, authUser, request);
        return ResponseEntity.ok(BaseResponse.success("좌석 정보가 수정되었습니다."));
    }

    @Operation(summary = "좌석 삭제")
    @DeleteMapping("/admin/seats/{seatId}")
    public ResponseEntity<BaseResponse<Void>> deleteSeat(
            @Parameter(description = "좌석 ID", example = "1001") @PathVariable @Positive Long seatId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        stadiumService.deleteSeat(seatId, authUser);
        return ResponseEntity.ok(BaseResponse.success("좌석이 삭제되었습니다."));
    }
}
