package com.teacat.server.performance.dto.response;

import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.entity.PerformanceStatus;
import com.teacat.server.stadium.entity.Stadium;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 공연 상세 응답 (API-202).
 *
 * 포스터·상세 이미지 URL 은 발급 시점부터 유효시간이 흐르는 임시 주소다.
 */
@Schema(description = "공연 상세 응답")
public record ConcertDetailResponse(

        @Schema(description = "공연 ID", example = "1")
        Long concertId,

        @Schema(description = "공연 제목", example = "티캣 단독 콘서트 2026")
        String title,

        @Schema(description = "공연 상태", example = "UPCOMING")
        PerformanceStatus status,

        @Schema(description = "티켓팅 오픈 시각")
        LocalDateTime ticketingStartAt,

        @Schema(description = "목록 노출 시작일")
        LocalDate visibleFrom,

        @Schema(description = "포스터 조회 URL")
        String posterUrl,

        @Schema(description = "상세 페이지 이미지 조회 URL")
        String detailImageUrl,

        @Schema(description = "공연장 정보")
        StadiumResponse stadium,

        @Schema(description = "회차 목록")
        List<ScheduleSummaryResponse> schedules,

        @Schema(description = "등록한 관리자 ID. 이 사람만 수정·삭제할 수 있다. 등록자를 알 수 없는 옛 데이터는 null",
                example = "6")
        Long createdBy,

        @Schema(description = "비공개 상태인가. 클라이언트 조회에서는 항상 false 다 — 비공개 공연은 거기서 404 라서. "
                + "등록자용 조회(/admin/concerts/{id})에서만 true 가 올 수 있다", example = "false")
        boolean hidden
) {

    @Schema(description = "공연장 정보")
    public record StadiumResponse(

            @Schema(description = "공연장 ID", example = "1")
            Long stadiumId,

            @Schema(description = "공연장 이름", example = "올림픽공원 체조경기장")
            String name,

            @Schema(description = "주소", example = "서울 송파구 올림픽로 424")
            String address,

            @Schema(description = "대표 전화", example = "02-410-1114")
            String phone
    ) {

        public static StadiumResponse from(Stadium stadium) {
            return new StadiumResponse(
                    stadium.getId(),
                    stadium.getName(),
                    stadium.getAddress(),
                    stadium.getPhone()
            );
        }
    }

    public static ConcertDetailResponse of(PerformanceGeneral performance,
                                           List<ScheduleSummaryResponse> schedules,
                                           String posterUrl,
                                           String detailImageUrl) {
        return new ConcertDetailResponse(
                performance.getId(),
                performance.getTitle(),
                performance.getStatus(),
                performance.getTicketingStartAt(),
                performance.getVisibleFrom(),
                posterUrl,
                detailImageUrl,
                StadiumResponse.from(performance.getStadium()),
                schedules,
                performance.getCreatedById(),
                performance.isHidden()
        );
    }
}
