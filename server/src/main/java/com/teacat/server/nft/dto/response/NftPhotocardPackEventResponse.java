package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftPhotocardPackEvent;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "카드팩 이벤트")
public record NftPhotocardPackEventResponse(

        @Schema(description = "이벤트 ID", example = "1") Long id,
        @Schema(description = "이벤트 코드. 수정할 수 없다", example = "SUMMER_2026") String code,
        @Schema(description = "이벤트 이름", example = "여름 맞이 카드팩") String name,
        @Schema(description = "시작 시각. null 이면 즉시") LocalDateTime startsAt,
        @Schema(description = "종료 시각. null 이면 무기한") LocalDateTime endsAt,
        @Schema(description = "스위치가 켜져 있는가", example = "true") boolean active,
        @Schema(description = "지금 지급되는가. active 가 켜져 있어도 기간 밖이면 false", example = "true")
        boolean ongoing,
        @Schema(description = "이 이벤트로 지급된 팩 수", example = "12") long grantedCount
) {

    /**
     * 지급 수는 부르는 쪽이 센다 — 목록은 한 번에 집계하고 단건은 그 코드만 센다.
     * {@code ongoing} 은 엔티티가 판단한다 (조건이 한 곳에만 있게).
     */
    public static NftPhotocardPackEventResponse of(NftPhotocardPackEvent event, LocalDateTime now,
                                                   long grantedCount) {
        return new NftPhotocardPackEventResponse(
                event.getId(), event.getCode(), event.getName(),
                event.getStartsAt(), event.getEndsAt(),
                event.isActive(), event.isOngoing(now), grantedCount);
    }
}
