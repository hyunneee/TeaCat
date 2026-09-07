package com.teacat.server.performance.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.performance.dto.request.PresignedUploadRequest;
import com.teacat.server.performance.dto.response.PresignedUploadResponse;
import com.teacat.server.performance.service.AdminPerformanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "공연 이미지 업로드", description = "관리자용 이미지 업로드 URL 발급 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/uploads")
@RequiredArgsConstructor
public class AdminUploadController {

    private final AdminPerformanceService adminPerformanceService;

    @Operation(summary = "이미지 업로드 URL 발급",
            description = "포스터·상세 이미지를 올릴 임시 URL 을 발급합니다. "
                    + "이 URL 로 파일을 PUT 한 뒤, 함께 받은 key 를 공연 등록·수정 API 에 넘기세요. "
                    + "파일이 서버를 거치지 않아 큰 이미지도 서버 자원을 쓰지 않습니다.")
    @PostMapping("/presigned")
    public ResponseEntity<BaseResponse<PresignedUploadResponse>> issueUploadUrl(
            @Valid @RequestBody PresignedUploadRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success(adminPerformanceService.issueUploadUrl(request)));
    }
}
