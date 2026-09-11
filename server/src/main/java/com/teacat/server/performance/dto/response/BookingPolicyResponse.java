package com.teacat.server.performance.dto.response;

import com.teacat.server.common.config.BookingPolicyProperties;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 공연 예매 정책 응답 (API-205).
 *
 * 취소 마감은 회차별 공연 시작 시각에서 설정된 만큼 앞당겨지므로 공연 단위로는 절대 시각을 줄 수 없다.
 * 여기서는 "공연 시작 전 일정 시간까지" 라는 규칙만 알려주고,
 * 회차별 실제 마감 시각은 회차 조회(API-203)의 cancelDeadlineAt 이 내려준다.
 */
@Schema(description = "공연 예매 정책 응답")
public record BookingPolicyResponse(

        @Schema(description = "공연 ID", example = "1")
        Long concertId,

        @Schema(description = "1인 최대 예매 매수", example = "1")
        int maxTicketsPerUser,

        @Schema(description = "동행자 지정 필수 여부. 1인 1매 정책에서는 false", example = "false")
        boolean companionRequired,

        @Schema(description = "입장 시 얼굴 인증 필요 여부", example = "true")
        boolean faceVerificationRequired,

        @Schema(description = "공연 시작 전 일정 시간까지 취소 가능한지. 회차별 마감 시각은 회차 조회에서 받는다",
                example = "true")
        boolean cancelableUntilPerformanceStart
) {

    public static BookingPolicyResponse of(Long concertId, BookingPolicyProperties policy) {
        return new BookingPolicyResponse(
                concertId,
                policy.maxTicketsPerUser(),
                policy.companionRequired(),
                policy.faceVerificationRequired(),
                true
        );
    }
}
