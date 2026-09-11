package com.teacat.server.performance.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 공연 수정 요청 (API-262).
 *
 * 보내지 않은(null) 필드는 그대로 둔다.
 * 티켓팅이 시작된 뒤에는 제목만 바꿀 수 있다 — 예매자가 이미 보고 결정한 정보이기 때문이다.
 */
@Schema(description = "공연 수정 요청. 바꿀 필드만 보내면 된다")
public record ConcertUpdateRequest(

        @Schema(description = "공연 제목", example = "티캣 단독 콘서트 2026 [앙코르]")
        @Size(max = 200, message = "공연 제목은 200자 이하여야 합니다.")
        String title,

        @Schema(description = "공연장 ID (티켓팅 시작 후 변경 불가)", example = "2")
        Long stadiumId,

        @Schema(description = "티켓팅 오픈 시각 (티켓팅 시작 후 변경 불가)", example = "2026-10-02T20:00:00")
        LocalDateTime ticketingStartAt,

        @Schema(description = "목록 노출 시작일 (티켓팅 시작 후 변경 불가)", example = "2026-09-21")
        LocalDate visibleFrom,

        @Schema(description = "새 포스터 key. 업로드 URL 발급(API-270)으로 받은 값을 넣는다",
                example = "performance/poster/2026/09/a1b2c3.png")
        String posterImageKey,

        @Schema(description = "새 상세 이미지 key", example = "performance/detail/2026/09/d4e5f6.png")
        String detailImageKey
) {

    /** 티켓팅 시작 후에는 건드릴 수 없는 필드가 하나라도 들어왔는지 */
    public boolean touchesLockedFields() {
        return stadiumId != null || ticketingStartAt != null || visibleFrom != null;
    }

    /** 이미지는 티켓팅 시작 후에도 교체할 수 있다 — 예매 조건이 아니기 때문이다 */
    public boolean touchesImages() {
        return posterImageKey != null || detailImageKey != null;
    }

    public boolean isEmpty() {
        return title == null && !touchesLockedFields() && !touchesImages();
    }
}
