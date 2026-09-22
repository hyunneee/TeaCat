package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "관리자 회원 상세의 카드팩")
public record NftPhotocardPackAdminResponse(
        Long packId,
        String source,
        String title,
        LocalDateTime openAt,
        Status status,
        LocalDateTime consumedAt,
        LocalDateTime invalidatedAt,
        String invalidatedReason,
        Long invalidatedBy
) {
    public enum Status {
        OPENABLE,
        SCHEDULED,
        PREPARING,
        CONSUMED,
        INVALIDATED
    }
}
