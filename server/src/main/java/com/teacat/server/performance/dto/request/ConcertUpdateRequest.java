package com.teacat.server.performance.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
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
        String detailImageKey,

        /*
         * 🔴 빈 문자열("")은 "바로가기 떼기" 다. 이 요청은 "안 보낸 필드(null)는 그대로" 라
         *    빈 문자열까지 무시하면 한 번 붙인 바로가기를 영영 못 뗀다. 그래서 @Pattern 이
         *    빈 문자열을 함께 허용한다 (@Pattern 은 null 을 통과시키므로 둘이 구분된다).
         */
        @Schema(description = """
                공연 상세의 '바로가기' 버튼이 갈 곳. 서비스 내 경로(`/nft/draw`) 또는
                외부 주소(`https://…`). **빈 문자열을 보내면 바로가기를 뗍니다.**
                보내지 않으면(null) 그대로 둡니다.
                """, example = "https://example.com/artist")
        @Pattern(regexp = "^$|^(/(?!/)\\S*|https?://\\S+)$",
                message = "'/' 로 시작하는 서비스 내 경로이거나 http(s) 로 시작하는 주소여야 합니다.")
        @Size(max = 500, message = "주소가 너무 깁니다.")
        String linkUrl
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
        return title == null && linkUrl == null && !touchesLockedFields() && !touchesImages();
    }
}
