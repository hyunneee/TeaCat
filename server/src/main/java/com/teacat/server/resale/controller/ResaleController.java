package com.teacat.server.resale.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.resale.dto.request.ApplyResaleRequest;
import com.teacat.server.resale.dto.response.ResaleEntryResponse;
import com.teacat.server.resale.dto.response.ResaleSectionResponse;
import com.teacat.server.resale.service.ResaleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 취소표 대기 (API-310 · 311 · 323 · 324).
 *
 * <p>추첨을 돌리는 API 는 없다. 취소표가 생기는 순간 서버가 온체인 추첨을 열고, 사용자는 결과만 본다.
 * 사용자가 직접 돌릴 수 있는 것처럼 보이면 공정성이 의심받는다.
 */
@Tag(name = "취소표 대기", description = "매진 구역 취소표 대기 신청 · 온체인(VerifiableDraw) 추첨 결과 조회 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequiredArgsConstructor
public class ResaleController {

    private final ResaleService resaleService;

    @Operation(
            summary = "취소표 구역별 현황 조회",
            description = """
                    회차의 판매 구역마다 대기 인원·가격·매진 여부를 돌려줍니다. (API-323)

                    - `soldOut=false` 인 구역은 남은 자리가 있으므로 대기가 아니라 예매를 해야 합니다.
                    - 회차 좌석이 아직 생성되지 않은 구역은 `soldOut=false` 입니다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "404", description = "`ERR_BOOKING_001` : 존재하지 않는 회차")
    })
    @GetMapping("/schedules/{scheduleId}/resale/sections")
    public ResponseEntity<BaseResponse<List<ResaleSectionResponse>>> sections(@PathVariable Long scheduleId) {
        return ResponseEntity.ok(BaseResponse.success(resaleService.sections(scheduleId)));
    }

    @Operation(
            summary = "취소표 대기 신청",
            description = """
                    매진된 구역에 추첨 대기를 겁니다. (API-310)

                    그 구역에서 결제 완료된 예매가 취소되면 서버가 **그 순간** 대기자 전원을 참가자로 묶어
                    온체인 추첨(VerifiableDraw, 커밋-리빌 + 블록해시)을 열고, 약 10초 뒤 난수가 확정되면
                    순위대로 당첨자에게 결제 기한(12시간)이 있는 좌석 선점과 알림을 줍니다.
                    당첨자는 `GET /me/resale` 에서 `WON` 을 보고 평소 예매 흐름(확인 → 결제)으로 결제합니다.

                    - 한 회차·한 구역에 대기는 하나만 걸 수 있습니다.
                    - 예매 취소 마감(공연 시작 − `booking.policy.cancel-deadline-lead`)이 지나면 신청할 수 없습니다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "신청 성공"),
            @ApiResponse(responseCode = "400", description = "`ERR_RESALE_007` : 1인 최대 신청 매수 초과"),
            @ApiResponse(responseCode = "404", description = """
                    - `ERR_BOOKING_001` : 존재하지 않는 회차
                    - `ERR_RESALE_002` : 이 회차에서 판매하는 구역이 아님
                    """),
            @ApiResponse(responseCode = "409", description = """
                    - `ERR_RESALE_003` : 잔여 좌석이 있는 구역 (바로 예매하면 됩니다)
                    - `ERR_RESALE_004` : 이미 이 구역에 대기 중
                    - `ERR_RESALE_005` : 예매 취소 마감이 지남
                    - `ERR_RESALE_006` : 이 회차 예매 가능 매수를 이미 채움
                    - `ERR_RESALE_011` : 예매가 열리지 않은 회차
                    """)
    })
    @PostMapping("/schedules/{scheduleId}/resale")
    public ResponseEntity<BaseResponse<ResaleEntryResponse>> apply(
            @PathVariable Long scheduleId,
            @Valid @RequestBody ApplyResaleRequest request,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        ResaleEntryResponse entry = resaleService.apply(authUser.id(), scheduleId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success("대기 신청이 완료되었습니다.", entry));
    }

    @Operation(
            summary = "내 취소표 대기 내역 조회",
            description = """
                    대기·당첨·결제 완료·만료·미당첨 상태와 결제 기한을 돌려줍니다. (API-324)

                    - `WON` 이면 `deadlineAt` 까지 `seatId` 를 결제해야 합니다. 좌석은 이미 내 선점(HELD)으로
                      잡혀 있으므로 예매 확인 화면(`/booking/{scheduleId}/review`)으로 바로 가면 됩니다.
                    - `drawKey` · `randomness` 는 당첨을 결정한 온체인 추첨의 키와 난수입니다. 참가자 목록과 함께
                      순위를 누구나 다시 계산할 수 있습니다.
                    - 스스로 취소·포기한 신청은 목록에 나오지 않습니다.
                    """
    )
    @ApiResponses(@ApiResponse(responseCode = "200", description = "조회 성공"))
    @GetMapping("/me/resale")
    public ResponseEntity<BaseResponse<List<ResaleEntryResponse>>> mine(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success(resaleService.mine(authUser.id())));
    }

    @Operation(
            summary = "취소표 대기 취소·당첨 포기",
            description = """
                    대기 중이면 신청을 취소하고, 당첨 상태면 구매권을 포기합니다. (API-311)

                    포기하면 좌석은 **곧바로 남은 대기자끼리 다시 추첨**됩니다. 되돌릴 수 없습니다.

                    - `rejoin=true` : 포기하면서 **다시 대기**합니다. 이 신청이 `WAITING` 으로 돌아가고
                      다음 취소표부터 다시 추첨에 참여합니다 (방금 놓친 좌석의 재추첨에는 들어가지 않습니다).
                    - `rejoin=false`(기본) : 대기를 끝냅니다 (`FORFEITED`, 목록에서 사라짐).
                    - 대기 중(`WAITING`) 신청에는 `rejoin` 이 의미가 없습니다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "처리 성공"),
            @ApiResponse(responseCode = "404", description = "`ERR_RESALE_001` : 내 신청이 아니거나 없음"),
            @ApiResponse(responseCode = "409", description = "`ERR_RESALE_008` : 이미 종료된 신청 (결제 완료·만료·미당첨)")
    })
    @DeleteMapping("/resale/{entryId}")
    public ResponseEntity<BaseResponse<Void>> cancel(
            @PathVariable Long entryId,
            @Parameter(description = "당첨 포기 시 다시 대기할지", example = "false")
            @RequestParam(defaultValue = "false") boolean rejoin,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        resaleService.cancel(authUser.id(), entryId, rejoin);
        return ResponseEntity.ok(BaseResponse.success(
                rejoin ? "당첨을 포기하고 다시 대기를 시작했습니다." : "대기 신청을 취소했습니다."));
    }
}
