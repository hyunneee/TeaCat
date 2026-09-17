package com.teacat.server.gate.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 검표 결과.
 *
 * <p>🔴 <b>{@code similarity} 와 {@code runnerUp} 은 화면 표시용이다. 로그·GA 에 남기지 마세요.</b>
 * 생체 판정 점수이고, 남으면 "누가 얼마나 닮았는지" 의 기록이 된다. 입장 기록
 * ({@code admissions})에도 점수를 저장하지 않는 것과 같은 이유다.
 *
 * <p>점수를 아예 안 내리는 것도 방법이지만, 지금은 임계값을 맞춰 가는 단계라 운영자가
 * "몇 점에서 보류가 뜨는지" 를 봐야 한다. 임계값이 확정되면 빼는 걸 검토한다
 * ({@code FaceVerifyResponse} 에 적힌 것과 같은 고민이다).
 */
@Schema(description = "현장 검표 결과")
public record GateVerifyResponse(

        @Schema(description = """
                판정.
                - `MATCH` : 통과. **입장 기록이 이미 만들어졌습니다** (되돌리려면 입장 취소)
                - `REVIEW` : 보류. 운영자가 좌석·이름을 보고 확인한 뒤 수동 통과하세요
                - `NO_MATCH` : 거절. 다시 촬영하세요
                """, example = "MATCH")
        GateDecision decision,

        @Schema(description = """
                이 회차에서 대조 대상이었던 티켓 수 (아직 입장하지 않은 것만).
                **0 이면 얼굴 검표를 쓸 수 없는 회차입니다** — 수동 검표로 진행하세요.
                """, example = "1183")
        long candidateCount,

        @Schema(description = "찾은 티켓. `NO_MATCH` 면 생략됩니다.")
        GateTicketResponse ticket,

        @Schema(description = "입장 처리된 시각. `MATCH` 일 때만 있습니다.",
                example = "2026-10-08T18:31:04")
        LocalDateTime admittedAt,

        @Schema(description = "가장 가까운 티켓과의 코사인 유사도. `NO_MATCH` 면 생략됩니다.",
                example = "0.7821")
        Double similarity,

        @Schema(description = """
                두 번째로 가까운 티켓과의 유사도. 1등과 이 값의 간격이 좁으면 누구인지
                모르는 상태라 통과시키지 않습니다. 후보가 하나뿐이었으면 생략됩니다.
                """, example = "0.4103")
        Double runnerUp
) {

    /** 후보가 아예 없었다 — 이 회차에 대조할 티켓이 없거나 전부 입장했다 */
    public static GateVerifyResponse noCandidates() {
        return new GateVerifyResponse(GateDecision.NO_MATCH, 0, null, null, null, null);
    }

    /** 안 닮았다. 🔴 가장 가까웠던 티켓이 누구였는지는 돌려주지 않는다 */
    public static GateVerifyResponse noMatch(long candidateCount) {
        return new GateVerifyResponse(GateDecision.NO_MATCH, candidateCount, null, null, null, null);
    }

    public static GateVerifyResponse review(long candidateCount, GateTicketResponse ticket,
            double similarity, Double runnerUp) {
        return new GateVerifyResponse(GateDecision.REVIEW, candidateCount, ticket, null,
                round(similarity), round(runnerUp));
    }

    public static GateVerifyResponse match(long candidateCount, GateTicketResponse ticket,
            LocalDateTime admittedAt, double similarity, Double runnerUp) {
        return new GateVerifyResponse(GateDecision.MATCH, candidateCount, ticket, admittedAt,
                round(similarity), round(runnerUp));
    }

    /** 소수점 넷째 자리까지. 그 아래는 조명만 바뀌어도 흔들리는 자리라 의미가 없다 */
    private static Double round(Double value) {
        return value == null ? null : Math.round(value * 10_000d) / 10_000d;
    }
}
