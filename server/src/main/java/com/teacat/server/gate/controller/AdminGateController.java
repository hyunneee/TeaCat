package com.teacat.server.gate.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.gate.dto.request.GateVerifyRequest;
import com.teacat.server.gate.dto.response.GateAdmissionResponse;
import com.teacat.server.gate.dto.response.GateSessionResponse;
import com.teacat.server.gate.dto.response.GateVerifyResponse;
import com.teacat.server.gate.entity.AdmissionMethod;
import com.teacat.server.gate.service.GateAdmissionService;
import com.teacat.server.gate.service.GateVerifyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 공연장 입구의 검표 화면이 쓰는 API. (GATE_PLAN.md 4-6)
 *
 * <p>🔴 <b>{@code gate.enabled} 가 true 일 때만 빈이 만들어진다.</b> 기본값은 false 라
 * 운영에서는 이 엔드포인트들이 <b>존재하지 않는다.</b> 아직 입장 절차를 운영하지 않기 때문이다.
 *
 * <p>주석으로 막지 않은 이유는 {@code shared/constants/features.ts} 가 적어 둔 그대로다 —
 * 주석 안의 코드는 타입 검사·린트를 안 받아 조용히 썩고, 되살릴 때 어디를 풀어야 하는지
 * 아무도 모른다. 이 방식이면 코드는 전부 컴파일되고 테스트도 돌며, 켤 때는
 * 환경변수({@code GATE_ENABLED}) 하나만 바꾸면 된다.
 *
 * <p>화면 쪽 스위치는 {@code FEATURE.gate} 다. <b>둘 다 필요하다</b> — 화면만 막으면 API 는
 * 열려 있고, 이건 남의 티켓을 1:N 으로 훑는 엔드포인트다.
 *
 * <p>접근 제어는 {@code SecurityConfig} 의 {@code /admin/**}(ADMIN 전용)이 맡는다.
 * 여기에 새 규칙을 더하지 않는다.
 */
@Tag(name = "현장 검표", description = "공연장 입구에서 얼굴로 티켓 주인을 확인하고 입장시키는 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/gate")
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "gate", name = "enabled", havingValue = "true")
public class AdminGateController {

    private final GateVerifyService gateVerifyService;
    private final GateAdmissionService gateAdmissionService;

    @Operation(summary = "회차 검표 현황",
            description = """
                    검표 화면이 **카메라를 켜기 전에** 부릅니다.

                    🔴 `faceEnrolledTickets` 가 **0 이면 이 회차는 얼굴 검표를 쓸 수 없습니다.**
                    가입할 때 채워 두는 기본 얼굴은 사람과 무관한 값이라 대조 대상이 아닙니다.
                    그 경우 카메라를 켜지 말고 수동 검표로 안내하세요 — 안 그러면 운영자가
                    한참 찍다가 전부 거절당한 뒤에야 알게 됩니다.
                    """)
    @GetMapping("/performance-details/{performanceDetailId}")
    public ResponseEntity<BaseResponse<GateSessionResponse>> getSession(
            @Parameter(description = "회차 ID", example = "77")
            @PathVariable Long performanceDetailId) {
        return ResponseEntity.ok(
                BaseResponse.success(gateVerifyService.getSession(performanceDetailId)));
    }

    @Operation(summary = "얼굴로 검표",
            description = """
                    찍은 얼굴이 이 회차의 누구인지 찾습니다.

                    🔴 **이미지를 보내지 않습니다.** 브라우저에서 뽑은 128차원 임베딩만 보냅니다.

                    품질 게이트를 통과한 프레임을 **여러 장 담아 한 번에** 보내세요. 서버가
                    각각 대조해 가장 높은 점수를 씁니다 — 한 프레임이 흔들려도 다른 프레임이
                    통과시킵니다. 평균을 내서 보내지 마세요.

                    `decision` 이 셋입니다.
                    - `MATCH` — 통과. **이 응답이 나갈 때 입장 기록이 이미 만들어져 있습니다.**
                    - `REVIEW` — 보류. 좌석·이름을 보여주고 운영자가 수동 통과를 누르게 하세요.
                    - `NO_MATCH` — 거절. 다시 촬영. **에러가 아니라 정상 응답입니다.**
                    """)
    @PostMapping("/performance-details/{performanceDetailId}/verify")
    public ResponseEntity<BaseResponse<GateVerifyResponse>> verify(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "회차 ID", example = "77")
            @PathVariable Long performanceDetailId,
            @Valid @RequestBody GateVerifyRequest request) {
        return ResponseEntity.ok(BaseResponse.success(
                gateVerifyService.verify(authUser.id(), performanceDetailId, request)));
    }

    @Operation(summary = "수동 통과",
            description = """
                    운영자가 육안으로 확인하고 들여보냅니다 (`method: MANUAL`).

                    판정이 `REVIEW` 로 떨어졌을 때, 그리고 얼굴을 쓸 수 없는 상황
                    (등록된 얼굴이 없는 회차·카메라 고장)에서 씁니다.
                    누가 통과시켰는지 기록에 남습니다.
                    """)
    @PostMapping("/tickets/{ticketId}/admit")
    public ResponseEntity<BaseResponse<GateAdmissionResponse>> admit(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "티켓 ID", example = "8812")
            @PathVariable Long ticketId) {
        return ResponseEntity.ok(BaseResponse.success("입장 처리했습니다.",
                GateAdmissionResponse.from(
                        gateAdmissionService.admit(ticketId, authUser.id(), AdmissionMethod.MANUAL))));
    }

    @Operation(summary = "입장 취소",
            description = """
                    잘못 처리한 입장을 되돌립니다.

                    되돌릴 수 없는 동작이 아니라 **잘못을 되돌리는** 동작입니다. 이게 없으면
                    오인 입장 한 건에 진짜 관객이 영구히 막힙니다 — 이미 입장한 티켓은
                    검표 후보에서 빠지기 때문입니다.
                    """)
    @DeleteMapping("/tickets/{ticketId}/admission")
    public ResponseEntity<BaseResponse<Void>> cancelAdmission(
            @Parameter(description = "티켓 ID", example = "8812")
            @PathVariable Long ticketId) {
        gateAdmissionService.cancel(ticketId);
        return ResponseEntity.ok(BaseResponse.success("입장을 취소했습니다."));
    }
}
