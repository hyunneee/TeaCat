package com.teacat.server.booking.dto.response;

import com.teacat.server.booking.repository.PerformanceSeatRepository.MyHold;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "내가 선점 중인 좌석 (결제 화면 표시용)")
public record MyHoldResponse(

        @Schema(description = "공연 회차 ID", example = "45")
        Long performanceDetailId,

        @Schema(description = "좌석 ID", example = "1024")
        Long seatId,

        @Schema(description = "선점 만료 시각")
        LocalDateTime heldUntil,

        @Schema(description = "만료까지 남은 시간(초). 서버(DB) 시계로 계산해 내려준다", example = "437")
        long remainingSeconds,

        @Schema(description = "공연명", example = "티캣 단독 콘서트")
        String performanceTitle,

        @Schema(description = "포스터 이미지 URL")
        String posterImg,

        @Schema(description = "회차 번호", example = "1")
        Integer performanceNum,

        @Schema(description = "공연 일시")
        LocalDateTime performanceDate,

        @Schema(description = "공연장명", example = "올림픽공원 체조경기장")
        String stadiumName,

        @Schema(description = "구역 코드", example = "A")
        String areaCode,

        @Schema(description = "좌석 열", example = "C")
        String rowLabel,

        @Schema(description = "좌석 번호", example = "17")
        Integer seatNumber,

        @Schema(description = "좌석 등급. 회차의 구역 정보가 없으면 null 로 내려간다", example = "VIP")
        String grade,

        @Schema(description = "좌석 가격(원). 회차의 구역 정보가 없으면 null 로 내려간다", example = "154000")
        Integer price
) {

    /**
     * @param posterUrl 발급된 조회용 임시 URL. 포스터가 없으면 null
     *
     * 🔴 **키를 그대로 넣지 마세요.** 예전에 {@code hold.getPosterImg()}(스토리지 키)를
     *    그대로 넘겨서 화면의 포스터가 깨졌습니다. 키 → URL 변환은 서비스가 합니다
     *    ({@code BookingService.posterUrl}) — 다른 응답들도 모두 같은 규칙입니다.
     */
    public static MyHoldResponse of(MyHold hold, String posterUrl) {
        return new MyHoldResponse(
                hold.getPerformanceDetailId(),
                hold.getSeatId(),
                hold.getHeldUntil(),
                hold.getRemainingSeconds(),
                hold.getPerformanceTitle(),
                posterUrl,
                hold.getPerformanceNum(),
                hold.getPerformanceDate(),
                hold.getStadiumName(),
                hold.getAreaCode(),
                hold.getRowLabel(),
                hold.getSeatNumber(),
                hold.getGrade(),
                hold.getPrice());
    }
}
