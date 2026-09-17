package com.teacat.server.gate.dto.response;

import com.teacat.server.gate.repository.GateTicketRepository.GateCountsProjection;
import com.teacat.server.performance.entity.PerformanceDetail;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 회차 검표 현황 — 게이트 화면이 들어오자마자 한 번 부른다.
 *
 * <p>🔴 <b>이 응답이 없으면 안 된다.</b> {@code faceEnrolledTickets} 가 0 이면 그 회차는
 * 얼굴로 검표할 수 없는데, 그걸 말해 주지 않으면 운영자는 카메라를 켜고 한참 찍다가
 * 전부 거절당한 뒤에야 알게 된다. 그때는 이미 줄이 밀려 있다.
 *
 * <p>지금 발권된 티켓은 <b>전부</b> 기본 얼굴({@code bootstrap-default})이라 실제로 0 이
 * 나온다 (GATE_PLAN.md 2-2). 화면은 이 값이 0 이면 카메라를 아예 켜지 말고
 * "수동 검표로 진행하세요" 를 보여줘야 한다.
 */
@Schema(description = "회차 검표 현황")
public record GateSessionResponse(

        @Schema(description = "회차 ID", example = "77")
        Long performanceDetailId,

        @Schema(description = "공연명", example = "테아캣 단독 콘서트")
        String title,

        @Schema(description = "회차 번호", example = "1")
        int performanceNum,

        @Schema(description = "공연 일시", example = "2026-10-08T19:00:00")
        LocalDateTime performanceDate,

        @Schema(description = "확정된 예매 수 (취소 제외)", example = "1200")
        long totalTickets,

        @Schema(description = """
                그중 **얼굴로 대조할 수 있는** 티켓 수. 가입 시 채워 둔 기본 얼굴은 세지 않습니다.
                🔴 **0 이면 이 회차는 얼굴 검표를 쓸 수 없습니다** — 카메라를 켜지 말고
                수동 검표로 진행하세요.
                """, example = "1183")
        long faceEnrolledTickets,

        @Schema(description = "이미 입장한 수", example = "17")
        long admittedCount
) {

    public static GateSessionResponse of(PerformanceDetail detail, GateCountsProjection counts) {
        return new GateSessionResponse(
                detail.getId(),
                detail.getPerformance().getTitle(),
                detail.getPerformanceNum(),
                detail.getPerformanceDate(),
                counts.getTotalTickets(),
                counts.getFaceEnrolledTickets(),
                counts.getAdmittedCount());
    }
}
