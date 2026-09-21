package com.teacat.server.resale.dto.response;

import com.teacat.server.performance.entity.PerformanceArea;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.resale.entity.ResaleEntry;
import com.teacat.server.resale.entity.ResaleEntryStatus;
import com.teacat.server.resale.entity.SeatDraw;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 내 취소표 대기 한 건.
 *
 * <p>ID 들이 문자열인 이유: 프론트 {@code ResaleEntry} 타입이 문자열 id 로 만들어져 있고(목업 시절),
 * 경로 파라미터로 그대로 쓴다. 숫자로 바꾸면 프론트 비교 연산이 조용히 어긋난다.
 */
@Schema(description = "취소표 대기 신청")
public record ResaleEntryResponse(
        @Schema(description = "신청 ID", example = "123")
        String id,
        @Schema(description = "회차 ID", example = "45")
        String scheduleId,
        @Schema(description = "구역(area) ID", example = "12")
        String sectionId,
        @Schema(description = "구역 코드", example = "A")
        String sectionName,
        @Schema(description = "등급", example = "VIP")
        String grade,
        @Schema(description = "가격(원)", example = "154000")
        int price,
        @Schema(description = "신청 매수", example = "1")
        int quantity,
        @Schema(description = "상태", example = "WON")
        ResaleEntryStatus status,
        @Schema(description = "당첨 결제 기한. WON 일 때만", nullable = true)
        LocalDateTime deadlineAt,
        @Schema(description = "신청 시각")
        LocalDateTime createdAt,
        @Schema(description = "공연 제목", example = "2026 월드투어")
        String concertTitle,
        @Schema(description = "아티스트. 공연 모델에 없어 빈 문자열", example = "")
        String artist,
        @Schema(description = "포스터가 없을 때 그라데이션 시드", example = "concert-7")
        String posterSeed,
        @Schema(description = "공연 시작 시각")
        LocalDateTime startAt,
        @Schema(description = "당첨 좌석 ID. 당첨 전이면 null", example = "1024", nullable = true)
        String seatId,
        @Schema(description = "당첨 추첨의 체인 키. 탐색기에서 DrawOpened/DrawRevealed 이벤트를 찾는 열쇠", nullable = true)
        String drawKey,
        @Schema(description = "체인에서 확정된 난수. 이 값과 참가자 목록으로 순위를 누구나 다시 계산할 수 있다", nullable = true)
        String randomness
) {
    public static ResaleEntryResponse of(ResaleEntry entry, PerformanceDetail detail, PerformanceArea area,
                                         SeatDraw draw) {
        return new ResaleEntryResponse(
                entry.getId().toString(),
                entry.getPerformanceDetailId().toString(),
                entry.getAreaId().toString(),
                area == null ? "" : area.getArea().getAreaCode(),
                area == null || area.getGrade() == null ? "" : area.getGrade(),
                area == null || area.getPrice() == null ? 0 : area.getPrice(),
                entry.getQuantity(),
                entry.getStatus(),
                entry.getDeadlineAt(),
                entry.getCreatedAt(),
                detail == null ? "" : detail.getPerformance().getTitle(),
                "",
                detail == null ? "" : "concert-" + detail.getPerformance().getId(),
                detail == null ? null : detail.getPerformanceDate(),
                entry.getSeatId() == null ? null : entry.getSeatId().toString(),
                draw == null ? null : draw.getDrawKey(),
                draw == null ? null : draw.getRandomness());
    }
}
