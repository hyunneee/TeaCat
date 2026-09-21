package com.teacat.server.performance.dto.response;

import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.entity.PerformanceStatus;
import com.teacat.server.stadium.entity.Stadium;
import com.teacat.server.stadium.entity.StadiumLayout;
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

        @Schema(description = "'바로가기' 버튼이 갈 곳. 서비스 내 경로 또는 외부 주소(http/https). 없으면 null이고 "
                + "그때는 버튼을 그리지 않는다", example = "https://example.com/artist")
        String linkUrl,

        @Schema(description = "공연장 정보")
        StadiumResponse stadium,

        @Schema(description = "이 공연이 쓰는 무대 형식(배치) 정보. 이 공연에서 팔 수 있는 구역의 범위다")
        LayoutResponse layout,

        @Schema(description = "회차 목록")
        List<ScheduleSummaryResponse> schedules,

        @Schema(description = "구역별 등급·가격. **등록자용 조회(/admin/concerts/{id})에서만 채워진다** — "
                + "수정 화면이 저장된 값을 되불러오는 데 쓴다. 클라이언트 조회(API-202)는 항상 빈 배열이고, "
                + "가격이 필요하면 GET /concerts/{concertId}/areas 를 쓴다")
        List<PerformanceAreaResponse> areas,

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

    /**
     * 이 공연이 쓰는 무대 형식(배치).
     *
     * 한 공연장이 무대를 U형·O형처럼 바꿀 수 있고 형식마다 구역이 다르게 나뉜다.
     * 수정 화면은 이 id 로 <b>그 형식의</b> 구역 목록을 불러와야 한다 —
     * 공연장의 기본 배치를 불러오면 다른 형식의 구역이 나와 저장이 거절된다 (PERFORMANCE_010).
     */
    @Schema(description = "무대 형식(배치) 정보")
    public record LayoutResponse(

            @Schema(description = "배치 ID", example = "1")
            Long layoutId,

            @Schema(description = "배치 이름", example = "O형 무대")
            String name
    ) {

        public static LayoutResponse from(StadiumLayout layout) {
            return new LayoutResponse(layout.getId(), layout.getName());
        }
    }

    /**
     * 클라이언트 조회(API-202)용. 구역 등급·가격은 담지 않는다 —
     * 그 정보는 공개 조회 API(GET /concerts/{concertId}/areas)가 따로 준다.
     */
    public static ConcertDetailResponse of(PerformanceGeneral performance,
                                           List<ScheduleSummaryResponse> schedules,
                                           String posterUrl,
                                           String detailImageUrl) {
        return of(performance, schedules, List.of(), posterUrl, detailImageUrl);
    }

    /** 등록자용 조회. 수정 화면이 되불러올 수 있게 구역 등급·가격까지 담는다 */
    public static ConcertDetailResponse of(PerformanceGeneral performance,
                                           List<ScheduleSummaryResponse> schedules,
                                           List<PerformanceAreaResponse> areas,
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
                performance.getLinkUrl(),
                StadiumResponse.from(performance.getStadium()),
                LayoutResponse.from(performance.getStadiumLayout()),
                schedules,
                areas,
                performance.getCreatedById(),
                performance.isHidden()
        );
    }
}
