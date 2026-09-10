package com.teacat.server.analytics.controller;

import com.teacat.server.analytics.dto.request.DeploymentRecordRequest;
import com.teacat.server.analytics.service.DeploymentService;
import com.teacat.server.common.response.BaseResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 배포 파이프라인이 부르는 내부 API.
 *
 * <p>사람이 아니라 젠킨스가 부른다. 로그인 세션이 없으므로 {@code X-Internal-Api-Key}
 * 헤더 하나로 인증한다 ({@code SecurityConfig} 에서 {@code /internal/**} 은
 * 스프링 시큐리티를 통과시키고, 키 검사는 서비스가 한다).
 *
 * <p>🔴 여기에 조회 API 를 늘리지 말 것. 이 경로는 토큰 없이 닿을 수 있고
 * 키 하나에만 기대고 있다. 읽을 것은 {@code /admin/analytics} 에 둔다.
 */
@Tag(name = "운영 통계 (내부)", description = "배포 파이프라인이 호출하는 내부 API")
@RestController
@RequestMapping("/internal/deployments")
@RequiredArgsConstructor
public class InternalDeploymentController {

    private static final String INTERNAL_API_KEY_HEADER = "X-Internal-Api-Key";

    private final DeploymentService deploymentService;

    @Operation(summary = "배포 기록",
            description = "배포 성공 직후 젠킨스가 호출합니다. 같은 환경의 같은 커밋이면 무시되므로 "
                    + "여러 번 보내도 안전합니다. 배포 시각은 서버가 받은 시각으로 찍습니다.")
    @PostMapping
    public ResponseEntity<BaseResponse<Void>> record(
            @Parameter(description = "내부 API 키", required = true)
            @RequestHeader(name = INTERNAL_API_KEY_HEADER, required = false) String internalApiKey,
            @Valid @RequestBody DeploymentRecordRequest request) {
        deploymentService.record(internalApiKey, request);
        return ResponseEntity.ok(BaseResponse.success("배포가 기록되었습니다."));
    }
}
