package com.teacat.server.banner.controller;

import com.teacat.server.banner.dto.request.BannerOrderRequest;
import com.teacat.server.banner.dto.request.BannerWriteRequest;
import com.teacat.server.banner.dto.response.AdminBannerResponse;
import com.teacat.server.banner.dto.response.BannerUploadUrlResponse;
import com.teacat.server.banner.service.AdminBannerService;
import com.teacat.server.common.response.BaseResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 메인 배너 관리 (ADMIN 전용).
 *
 * /admin/** 는 SecurityConfig 의 포괄 규칙이 ADMIN 으로 잠근다.
 */
@Tag(name = "메인 배너 관리", description = "관리자 배너 등록 · 수정 · 순서 변경 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/banners")
@RequiredArgsConstructor
@Validated
public class AdminBannerController {

    private final AdminBannerService adminBannerService;

    @Operation(summary = "배너 목록", description = "노출을 끈 배너까지 순서대로 전부 보여줍니다.")
    @GetMapping
    public ResponseEntity<BaseResponse<List<AdminBannerResponse>>> getAll() {
        return ResponseEntity.ok(BaseResponse.success(adminBannerService.getAll()));
    }

    @Operation(
            summary = "배너 이미지 업로드 URL 발급",
            description = "이 URL 로 파일을 PUT 한 뒤, 함께 받은 key 를 등록·수정 API 에 넘기세요. "
                    + "파일이 서버를 거치지 않아 큰 이미지도 서버 자원을 쓰지 않습니다."
    )
    @PostMapping("/uploads/presigned")
    public ResponseEntity<BaseResponse<BannerUploadUrlResponse>> issueUploadUrl(
            @RequestParam @NotBlank(message = "파일 형식을 알려주세요.") String contentType) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success(adminBannerService.issueUploadUrl(contentType)));
    }

    @Operation(
            summary = "배너 등록",
            description = "이미지를 직접 올리거나(IMAGE) 공연을 지정합니다(PERFORMANCE). 새 배너는 맨 뒤에 붙습니다."
    )
    @PostMapping
    public ResponseEntity<BaseResponse<AdminBannerResponse>> create(
            @Valid @RequestBody BannerWriteRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success("배너가 등록되었습니다.", adminBannerService.create(request)));
    }

    @Operation(summary = "배너 수정", description = "유형을 바꿀 수도 있습니다. 이미지를 갈아끼우면 옛 파일은 지워집니다.")
    @PutMapping("/{bannerId}")
    public ResponseEntity<BaseResponse<AdminBannerResponse>> update(
            @PathVariable Long bannerId,
            @Valid @RequestBody BannerWriteRequest request) {
        return ResponseEntity.ok(BaseResponse.success(
                "배너가 수정되었습니다.", adminBannerService.update(bannerId, request)));
    }

    @Operation(summary = "배너 삭제", description = "되돌릴 수 없습니다. 올린 이미지도 함께 지워집니다.")
    @DeleteMapping("/{bannerId}")
    public ResponseEntity<BaseResponse<Void>> delete(@PathVariable Long bannerId) {
        adminBannerService.delete(bannerId);
        return ResponseEntity.ok(BaseResponse.success("배너가 삭제되었습니다."));
    }

    @Operation(
            summary = "배너 순서 변경",
            description = "지금 있는 배너 **전부**를 원하는 순서대로 담아 보냅니다. 일부만 보내면 거절됩니다."
    )
    @PutMapping("/order")
    public ResponseEntity<BaseResponse<List<AdminBannerResponse>>> reorder(
            @Valid @RequestBody BannerOrderRequest request) {
        return ResponseEntity.ok(BaseResponse.success(
                "순서가 변경되었습니다.", adminBannerService.reorder(request)));
    }
}
