package com.teacat.server.ticket.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.ticket.dto.response.MyTicketResponse;
import com.teacat.server.ticket.service.TicketQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 관리자 회원 상세의 "예매" 탭.
 *
 * <p>{@link TicketController}(본인 조회)와 <b>같은 서비스·같은 응답</b>을 씁니다. 다른 것은
 * 회원을 어디서 얻느냐 하나뿐입니다 — 저쪽은 토큰에서, 여기는 경로에서 얻습니다.
 * 조회 로직을 한 벌 더 만들면 필드가 갈라져서, 관리자가 보는 예매와 사용자가 보는 예매가
 * 달라집니다.
 *
 * <p>경로를 {@code /admin/users/{userId}/...} 로 두되 컨트롤러는 <b>티켓 도메인</b>에 둡니다
 * ({@code wallet} 의 {@code AdminCatMoneyController} 와 같은 규칙) — 데이터를 가진 쪽이
 * 들고 있어야 응답이 바뀔 때 한 곳만 고칩니다.
 *
 * <p>접근 제어는 {@code SecurityConfig} 의 {@code /admin/**}(ADMIN 전용)이 맡습니다.
 */
@Tag(name = "회원 관리", description = "관리자가 특정 회원의 예매를 조회하는 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/users/{userId}/tickets")
@RequiredArgsConstructor
public class AdminTicketController {

    private final TicketQueryService ticketQueryService;

    @Operation(summary = "회원 예매 목록 조회",
            description = "그 회원이 예매한 티켓을 최신순으로 돌려줍니다. 취소된 예매도 "
                    + "`status: CANCELLED` 로 함께 내려갑니다 — 관리자는 \"취소했다\" 는 사실도 "
                    + "봐야 하므로 거르지 않습니다.\n\n"
                    + "없는 회원이면 빈 배열입니다. 회원이 있는지는 `GET /admin/users/{userId}` 가 "
                    + "먼저 답하므로 여기서 다시 확인하지 않습니다.")
    @GetMapping
    public ResponseEntity<BaseResponse<List<MyTicketResponse>>> getUserTickets(
            @Parameter(description = "회원 ID", example = "42") @PathVariable Long userId) {
        return ResponseEntity.ok(BaseResponse.success(ticketQueryService.getMyTickets(userId)));
    }
}
