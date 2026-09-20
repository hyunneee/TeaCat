package com.teacat.server.ticket.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.performance.service.PerformanceOperatorAccess;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.ticket.dto.request.CheckInScanRequest;
import com.teacat.server.ticket.dto.request.CheckInVerifyRequest;
import com.teacat.server.ticket.dto.response.CheckInResultResponse;
import com.teacat.server.ticket.dto.response.CheckInTicketResponse;
import com.teacat.server.ticket.service.TicketCheckInService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 게이트 입장 확인 (ADMIN 또는 담당 공연 기획자).
 *
 * <p>SecurityConfig에서 역할을 검사하고, 티켓 조회 전에 담당 공연의 회차인지 검사한다.
 */
@Tag(name = "입장 확인", description = "공연장 게이트에서 QR + 얼굴로 본인을 확인하는 운영 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/check-in")
@RequiredArgsConstructor
public class AdminTicketCheckInController {
    private final PerformanceOperatorAccess access;


    private final TicketCheckInService checkInService;

    @Operation(
            summary = "티켓 확인 (1단계)",
            description = """
                    QR 을 찍은 직후 **이 표가 맞는지** 확인합니다. 아직 입장 처리하지 않습니다.

                    QR 을 찍었으면 `qrToken`, 번호를 손으로 넣었으면 `ticketId` 를 보냅니다.

                    취소된 표(`TICKET_007`) · 다른 회차(`TICKET_006`) · 이미 입장한 표(`TICKET_008`)는
                    **얼굴을 찍기 전에** 거절합니다. 통과할 수 없는 사람의 생체정보를 받지 않기 위해서입니다.

                    🔴 위조된 QR 과 없는 티켓은 **같은 오류**(`TICKET_005`)입니다 — 구분해 주면
                    번호를 하나씩 넣어보며 존재하는 티켓을 찾아낼 수 있습니다.
                    """
    )
    @PostMapping("/scan")
    public ResponseEntity<BaseResponse<CheckInTicketResponse>> scan(
            @AuthenticationPrincipal AuthUser actor,
            @Valid @RequestBody CheckInScanRequest request) {
        access.schedule(actor, request.performanceDetailId());

        return ResponseEntity.ok(BaseResponse.success(checkInService.scan(request)));
    }

    @Operation(
            summary = "얼굴 대조 후 입장 처리 (2단계)",
            description = """
                    게이트에서 찍은 얼굴을 **예매 당시 얼굴**과 대조하고, 같은 사람이면 입장 처리합니다.

                    🔴 `match: false` 는 **에러가 아니라 정상 응답(200)** 입니다 — "다른 사람이다" 라는
                    답입니다. 이때는 입장 기록을 남기지 않습니다(본인이 다시 찍을 수 있어야 합니다).

                    🔴 **원본 이미지는 받지 않습니다.** 검표기(브라우저)에서 뽑은 128 차원 임베딩만
                    보냅니다. 대조와 판정은 서버가 합니다 — 저장된 임베딩은 서버 밖으로 나가지 않습니다.

                    예매 당시 얼굴이 없거나(탈퇴로 파기 · 가입 시 기본 얼굴) 모델이 다르면
                    `TICKET_009` / `TICKET_010` 으로 거절합니다. **낮은 점수로 떨어뜨리지 않습니다.**
                    """
    )
    @PostMapping("/verify")
    public ResponseEntity<BaseResponse<CheckInResultResponse>> verify(
            @AuthenticationPrincipal AuthUser actor,
            @Valid @RequestBody CheckInVerifyRequest request) {
        access.schedule(actor, request.performanceDetailId());

        return ResponseEntity.ok(BaseResponse.success(checkInService.verify(request)));
    }
}
