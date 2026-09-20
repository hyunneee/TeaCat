package com.teacat.server.performance.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.performance.dto.request.OperationsCheckInFilter;
import com.teacat.server.performance.dto.response.OperationsAttendeeDetailResponse;
import com.teacat.server.performance.dto.response.OperationsAttendeePageResponse;
import com.teacat.server.performance.dto.response.OperationsSeatMapResponse;
import com.teacat.server.performance.service.PerformanceOperationsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 운영 콘솔 <b>좌석·예매자</b> 조회 (ADMIN 또는 담당 공연 기획자).
 *
 * <p>{@code SecurityConfig} 가 역할을 걸러 주고, <b>담당 공연인지와 회차·티켓의 연결은
 * 서비스가</b> 검사한다 ({@link PerformanceOperationsService} 주석). 역할 검사만으로는 다른
 * 주최자가 남의 공연 ID 를 넣는 것을 막을 수 없다.
 *
 * <p>🔴 <b>응답을 캐시하지 않는다.</b> 명단에는 (가렸더라도) 예매자 정보가 있고, 공연장에서는
 * 한 대의 노트북을 여러 운영자가 번갈아 쓴다. 뒤로가기로 이전 운영자가 보던 명단이 되살아나면
 * 안 되고, 중간 프록시에 남아서도 안 된다.
 */
@Tag(name = "공연 운영", description = "담당 공연의 회차 좌석 현황과 예매자 명단을 조회하는 운영 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/performances/{performanceId}/schedules/{scheduleId}/operations")
@RequiredArgsConstructor
public class AdminPerformanceOperationsController {

    private final PerformanceOperationsService operationsService;

    @Operation(
            summary = "운영 좌석맵 조회",
            description = """
                    회차의 좌석 배치에 **예매·선점·입장** 상태를 얹어 돌려줍니다.

                    좌석에는 티켓 번호까지만 있습니다 — **예매자 정보는 담기지 않습니다.**
                    좌석을 눌렀을 때 `GET .../operations/attendees/{ticketId}` 로 한 건씩 조회하세요.

                    스탠딩 구역은 좌석 배열이 비어 있고 `capacity`·`bookedCount`·`checkedInCount` 로
                    옵니다. 가짜 좌석 번호를 만들지 않습니다.

                    담당 공연이 아니면 `PERFORMANCE_020`, 이 공연의 회차가 아니면 `PERFORMANCE_006` 입니다.
                    """
    )
    @GetMapping("/seats")
    public ResponseEntity<BaseResponse<OperationsSeatMapResponse>> getSeatMap(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser actor,
            @Parameter(description = "공연 ID", example = "1") @PathVariable Long performanceId,
            @Parameter(description = "회차 ID", example = "10") @PathVariable Long scheduleId) {
        return noStore()
                .body(BaseResponse.success(operationsService.getSeatMap(actor, performanceId, scheduleId)));
    }

    @Operation(
            summary = "예매자 명단 조회",
            description = """
                    티켓 한 장이 한 줄입니다. 주문 하나로 좌석 여러 장을 살 수 있어 주문 단위로 묶으면
                    좌석과 이어지지 않습니다.

                    이름·연락처는 **서버가 가려서** 내려보냅니다(`홍*동`, `010-****-5678`).

                    취소된 표도 함께 옵니다(`status: CANCELLED`) — 운영 문의가 대개 취소 건입니다.
                    집계(`/seats` 의 summary)에서는 빠집니다.

                    페이지 이동은 **티켓 번호 커서**입니다. 마지막 줄의 `nextCursor` 를 그대로 보내세요.
                    필터를 바꾸면 커서를 비워 첫 페이지부터 받아야 합니다.
                    """
    )
    @GetMapping("/attendees")
    public ResponseEntity<BaseResponse<OperationsAttendeePageResponse>> getAttendees(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser actor,
            @Parameter(description = "공연 ID", example = "1") @PathVariable Long performanceId,
            @Parameter(description = "회차 ID", example = "10") @PathVariable Long scheduleId,
            @Parameter(description = "이름·닉네임 검색어. 숫자만 넣으면 티켓 번호로도 찾습니다")
            @RequestParam(required = false) String keyword,
            @Parameter(description = "구역 ID. 없으면 전 구역", example = "7")
            @RequestParam(required = false) Long areaId,
            @Parameter(description = "입장 상태 필터. 기본 ALL")
            @RequestParam(required = false) OperationsCheckInFilter checkIn,
            @Parameter(description = "이전 페이지의 nextCursor", example = "1024")
            @RequestParam(required = false) String cursor,
            @Parameter(description = "한 페이지 수 (기본 30, 최대 100)", example = "30")
            @RequestParam(required = false) Integer size) {
        return noStore().body(BaseResponse.success(operationsService.getAttendees(
                actor, performanceId, scheduleId, keyword, areaId, checkIn, cursor, size)));
    }

    @Operation(
            summary = "예매자(티켓) 상세 조회",
            description = """
                    좌석맵에서 좌석을 누르거나 명단에서 한 줄을 눌렀을 때 오른쪽에 띄울 정보입니다.

                    🔴 **얼굴 임베딩과 QR 비밀값은 내려가지 않습니다.** 대조와 입장 처리는 입장 확인
                    화면(`/admin/check-in`)에서 서버가 합니다.

                    없는 티켓과 다른 회차의 티켓은 **같은 404**(`TICKET_001`)입니다 — 구분해 주면
                    번호를 하나씩 넣어 보며 존재하는 티켓을 찾아낼 수 있습니다.
                    """
    )
    @GetMapping("/attendees/{ticketId}")
    public ResponseEntity<BaseResponse<OperationsAttendeeDetailResponse>> getAttendee(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser actor,
            @Parameter(description = "공연 ID", example = "1") @PathVariable Long performanceId,
            @Parameter(description = "회차 ID", example = "10") @PathVariable Long scheduleId,
            @Parameter(description = "티켓 번호", example = "1024") @PathVariable Long ticketId) {
        return noStore().body(BaseResponse.success(
                operationsService.getAttendee(actor, performanceId, scheduleId, ticketId)));
    }

    /** 개인정보가 실린 조회라 브라우저·프록시에 남기지 않는다 (클래스 주석) */
    private ResponseEntity.BodyBuilder noStore() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore().cachePrivate());
    }
}
