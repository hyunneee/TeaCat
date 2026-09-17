package com.teacat.server.ticket.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.ticket.dto.response.MyTicketResponse;
import com.teacat.server.ticket.dto.response.TicketQrResponse;
import com.teacat.server.ticket.service.TicketQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "내 티켓", description = "예매한 티켓 조회 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/users/me/tickets")
@RequiredArgsConstructor
public class TicketController {

    private final TicketQueryService ticketQueryService;

    @Operation(
            summary = "내 티켓 목록",
            description = """
                    예매한 티켓을 최신순으로 돌려줍니다. 없으면 빈 배열입니다.

                    - `nftStatus`는 **예매 상태와 다른 축**입니다. `PENDING`/`MINTING`/`FAILED`
                      여도 예매는 유효하니 실패로 보여주지 마세요. 체인 확정에 보통 10초쯤 걸립니다.
                    - 취소된 예매는 `status`가 `CANCELLED`로 함께 내려갑니다.
                    - `posterUrl`은 유효시간이 있는 임시 주소라 캐시하지 마세요.
                    - 예매 취소는 `ticketOrderId`로 겁니다 — `POST /payments/ticket-orders/{id}/cancel`.
                      이 값이 없는 티켓은 취소 버튼을 보여주지 마세요.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공 (티켓이 없으면 빈 배열)")
    })
    @GetMapping
    public ResponseEntity<BaseResponse<List<MyTicketResponse>>> getMyTickets(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser
    ) {
        return ResponseEntity.ok(BaseResponse.success(
                ticketQueryService.getMyTickets(authUser.id())));
    }

    @Operation(
            summary = "내 티켓 단건 조회",
            description = """
                    티켓 한 장을 조회합니다. NFT 발행이 확정됐는지 확인할 때도 씁니다.

                    - 본인의 티켓만 조회할 수 있습니다.
                    - `nftStatus`가 `MINTED`가 되면 `tokenId`가 함께 채워집니다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(
                    responseCode = "403",
                    description = "`TICKET_002` : 본인의 티켓이 아님",
                    content = @Content(
                            schema = @Schema(implementation = BaseResponse.class),
                            examples = @ExampleObject(
                                    name = "TICKET_002",
                                    value = """
                                            {
                                              "success": false,
                                              "code": "TICKET_002",
                                              "message": "본인의 티켓이 아닙니다."
                                            }
                                            """
                            )
                    )
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "`TICKET_001` : 존재하지 않는 티켓",
                    content = @Content(schema = @Schema(implementation = BaseResponse.class))
            )
    })
    @GetMapping("/{ticketId}")
    public ResponseEntity<BaseResponse<MyTicketResponse>> getMyTicket(
            @Parameter(description = "티켓 ID", example = "1")
            @PathVariable Long ticketId,

            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser
    ) {
        return ResponseEntity.ok(BaseResponse.success(
                ticketQueryService.getMyTicket(authUser.id(), ticketId)));
    }

    @Operation(
            summary = "티켓 QR 조회",
            description = """
                    게이트에서 보여줄 QR 문자열입니다. **QR 이미지가 아니라 문자열**이고,
                    그림은 화면이 그립니다.

                    🔴 티켓 번호를 그대로 담지 않고 **서버가 서명한 값**입니다. 번호를 그대로
                    담으면 아무 숫자나 QR 로 만들어 게이트에 들이대는 것만으로 남의 예매 정보가
                    검표 화면에 뜹니다.

                    만료는 없습니다 — 공연장 입구는 보통 전파가 나빠서 짧은 수명 토큰이면
                    화면을 띄우는 동안 만료됩니다. 대신 **한 번 입장하면 그 티켓은 다시 쓸 수 없습니다.**
                    """
    )
    @GetMapping("/{ticketId}/qr")
    public ResponseEntity<BaseResponse<TicketQrResponse>> getMyTicketQr(
            @Parameter(description = "티켓 ID", example = "1")
            @PathVariable Long ticketId,

            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser
    ) {
        return ResponseEntity.ok(BaseResponse.success(
                ticketQueryService.getMyTicketQr(authUser.id(), ticketId)));
    }
}
