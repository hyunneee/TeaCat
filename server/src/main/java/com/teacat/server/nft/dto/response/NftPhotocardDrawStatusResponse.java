package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
import java.util.List;

/** 내 포토카드의 카드팩 칸(×n)과 뽑기 화면의 "다시 뽑기" 버튼이 이 값을 본다 */
public record NftPhotocardDrawStatusResponse(
        @Schema(description = "지금 뽑을 수 있는가 (remaining > 0)") boolean available,
        @Schema(description = "지금 열 수 있는 카드팩 수", example = "1") long remaining,
        @Schema(description = "아직 안 열린 카드팩 수. 결제 직후부터 여기에 잡힌다", example = "1") long scheduled,
        @Schema(description = "가장 빨리 열리는 시각. 잠긴 팩이 없으면 null. `packs` 의 잠긴 팩 중 가장 이른 `openAt` 과 같다")
        LocalDateTime nextOpenAt,
        @Schema(description = """
                안 쓴 카드팩 목록 — **팩마다** 개봉 시각과 열 수 있는지를 준다.
                열 수 있는 팩이 먼저, 그다음 개봉이 이른 순이다. 최대 50개까지만 내려가며 전체 수는
                `remaining`·`scheduled` 가 답한다.
                """)
        List<Pack> packs
) {

    /**
     * 카드팩 한 개.
     *
     * <p>🔴 {@code openAt} 은 <b>저장된 값이 아니라 계산한 값</b>이다 — 그 회차의 공연 일시에서 매번
     * 뺀다. 공연을 연기하면 이 값도 함께 밀리고, 예매 취소 마감과 어긋나지 않는다.
     */
    @Schema(description = "안 쓴 카드팩 한 개")
    public record Pack(
            @Schema(description = "카드팩 ID", example = "12") Long packId,
            @Schema(description = "받은 경로 — TICKET_PURCHASE 예매 · TICKET_ENTRY 입장 · EVENT 이벤트",
                    example = "TICKET_PURCHASE") String source,
            @Schema(description = "어디서 받은 팩인지 화면에 쓸 이름. 예매 팩은 공연명, 이벤트 팩은 이벤트 이름",
                    example = "테아캣 단독 콘서트") String title,
            @Schema(description = "개봉 시각(계산값). 이벤트 팩처럼 회차가 없어 언제든 열 수 있으면 null",
                    example = "2026-10-08T18:50:00") LocalDateTime openAt,
            @Schema(description = "지금 열 수 있는가. 서버가 DB 시계로 판정한다", example = "false") boolean openable
    ) {
    }
}
