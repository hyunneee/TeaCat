package com.teacat.server.queue.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.queue.dto.request.QueueConfigRequest;
import com.teacat.server.queue.dto.response.QueueAdminStatusResponse;
import com.teacat.server.queue.service.QueueService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자용. {@code /admin/**} 은 SecurityConfig 의 포괄 규칙으로 ADMIN 전용이다.
 *
 * <p>정원은 환경변수가 원본이다. 여기서는 회차마다 대기실을 켜고 끄고, 예외 상황에만 회차별 override 를 둔다.
 */
@Tag(name = "가상 대기실 관리", description = "관리자 대기실 켜기/끄기 · 현황 · 회차별 정원 override")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/queue")
@RequiredArgsConstructor
public class AdminQueueController {

    private final QueueService queueService;

    @Operation(summary = "대기실 현황", description = "대기 인원 · 입장 인원 · 적용 중인 정원 · 최근 60초 입장 속도")
    @GetMapping("/{scheduleId}")
    public ResponseEntity<BaseResponse<QueueAdminStatusResponse>> status(
            @Parameter(description = "회차 ID", example = "30") @PathVariable Long scheduleId) {
        return ResponseEntity.ok(BaseResponse.success(queueService.adminStatus(scheduleId)));
    }

    @Operation(
            summary = "대기실 설정",
            description = """
                    `enabled` 로 회차의 대기실을 켜고 끕니다. 기본은 꺼짐이고, 꺼진 회차는 기존 흐름이 그대로입니다.

                    `capacity` · `maxPerTick` · `ttlSec` 는 **이 회차만** 환경변수 값을 덮어씁니다. 평소에는 보내지 마세요.
                    null 로 보내면 override 를 지웁니다. `maxPerTick` 이 `capacity` 보다 크면 `ERR_QUEUE_004` 입니다.
                    """)
    @PutMapping("/{scheduleId}/config")
    public ResponseEntity<BaseResponse<QueueAdminStatusResponse>> updateConfig(
            @Parameter(description = "회차 ID", example = "30") @PathVariable Long scheduleId,
            @Valid @RequestBody QueueConfigRequest request) {
        return ResponseEntity.ok(BaseResponse.success(queueService.updateConfig(scheduleId, request)));
    }

    @Operation(
            summary = "대기실 초기화",
            description = "대기열 · 입장 표식 · 설정을 모두 지웁니다. 회차가 끝난 뒤 정리용입니다. 진행 중인 회차에 쓰면 대기 중이던 사용자가 줄 뒤로 밀립니다.")
    @DeleteMapping("/{scheduleId}")
    public ResponseEntity<BaseResponse<Void>> reset(
            @Parameter(description = "회차 ID", example = "30") @PathVariable Long scheduleId) {
        queueService.reset(scheduleId);
        return ResponseEntity.ok(BaseResponse.success("대기실을 초기화했습니다."));
    }
}
