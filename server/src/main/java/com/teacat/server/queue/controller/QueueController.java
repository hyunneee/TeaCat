package com.teacat.server.queue.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.queue.dto.response.QueueStatusResponse;
import com.teacat.server.queue.service.QueueService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "가상 대기실", description = "티켓 오픈 때 좌석 페이지 입장 인원을 정원 이하로 묶는 대기열 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/queue")
@RequiredArgsConstructor
public class QueueController {

    private final QueueService queueService;

    @Operation(
            summary = "대기열 진입",
            description = """
                    예매하기를 누를 때 부릅니다. 대기열 맨 뒤에 서고 순번을 돌려줍니다.

                    - 이미 서 있으면 순번을 **유지**합니다 (새로고침 안전).
                    - 이미 입장 상태면 `admitted: true` 를 그대로 돌려줍니다.
                    - 대기실을 운영하지 않는 회차면 `ERR_QUEUE_003`(409) 입니다. 먼저 `GET /queue/{id}/status` 로
                      `enabled` 를 확인하면 이 오류를 만나지 않습니다.
                    """)
    @PostMapping("/{scheduleId}/enter")
    public ResponseEntity<BaseResponse<QueueStatusResponse>> enter(
            @Parameter(description = "회차 ID", example = "30") @PathVariable Long scheduleId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success(queueService.enter(scheduleId, authUser.id())));
    }

    @Operation(
            summary = "내 대기 상태",
            description = """
                    대기실 화면이 `pollAfterSec` 주기로 부릅니다. Redis 조회 몇 번으로 끝나 DB 에 가지 않습니다.

                    - `enabled: false` 면 대기실이 꺼진 회차입니다. `admitted` 는 항상 true 이고 대기실을 건너뜁니다.
                    - `admitted: true` 가 되면 좌석 페이지로 이동하세요. 좌석·선점 API 를 부를 때마다 입장 상태가 연장됩니다.
                    - 대기열에도 입장 표식에도 없으면(무활동으로 빠진 뒤 돌아온 경우) 다시 줄 뒤에 섭니다.
                    """)
    @GetMapping("/{scheduleId}/status")
    public ResponseEntity<BaseResponse<QueueStatusResponse>> status(
            @Parameter(description = "회차 ID", example = "30") @PathVariable Long scheduleId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success(queueService.status(scheduleId, authUser.id())));
    }

    @Operation(
            summary = "대기열 이탈",
            description = """
                    결제 완료 화면 진입, 뒤로가기, 탭 닫기(`beforeunload`)에서 부릅니다. 대기열과 입장 상태를 모두 비웁니다.
                    부르지 못해도 무활동 시간(기본 10분)이 지나면 자동으로 빠집니다 — 그만큼 다음 사람 입장이 늦어질 뿐입니다.
                    """)
    @DeleteMapping("/{scheduleId}/leave")
    public ResponseEntity<BaseResponse<Void>> leave(
            @Parameter(description = "회차 ID", example = "30") @PathVariable Long scheduleId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        queueService.leave(scheduleId, authUser.id());
        return ResponseEntity.ok(BaseResponse.success("대기열에서 나왔습니다."));
    }
}
