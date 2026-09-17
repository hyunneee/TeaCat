package com.teacat.server.ticket.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 얼굴 대조 결과.
 *
 * <p>🔴 <b>{@code match: false} 는 에러가 아니다.</b> "안 닮았다" 도 정상적인 답이라
 * 200 으로 내려준다 — 게이트 화면이 점수를 보여주고 다시 찍게 해야 하기 때문이다.
 * 에러로 만들면 화면이 "무엇이 잘못됐는지" 와 "다른 사람이다" 를 구분할 수 없다.
 *
 * <p>⚠️ {@code similarity} 는 {@code FaceVerifyResponse} 와 같은 이유로 지금만 내려준다 —
 * 실제 사람들로 임계값을 맞춰보는 단계다. 운영에 굳으면 빼는 것을 검토할 것.
 */
@Schema(description = "입장 확인 - 얼굴 대조 결과")
public record CheckInResultResponse(

        @Schema(description = "같은 사람으로 판정했는가", example = "true")
        boolean match,

        @Schema(description = "코사인 유사도 (-1 ~ 1). 검증용 값입니다", example = "0.7213")
        double similarity,

        @Schema(description = "이 값 이상이면 같은 사람으로 봅니다", example = "0.65")
        double threshold,

        @Schema(description = "입장 처리된 시각. 판정이 false 면 생략됩니다.")
        LocalDateTime checkedInAt,

        @Schema(description = "확인한 티켓")
        CheckInTicketResponse ticket
) {

    public static CheckInResultResponse of(
            double similarity, double threshold, LocalDateTime checkedInAt, CheckInTicketResponse ticket) {
        return new CheckInResultResponse(
                similarity >= threshold, round(similarity), threshold, checkedInAt, ticket);
    }

    /** 소수점 넷째 자리까지. 그 아래는 조명만 바뀌어도 흔들리는 자리라 의미가 없다 */
    private static double round(double value) {
        return Math.round(value * 10_000d) / 10_000d;
    }
}
