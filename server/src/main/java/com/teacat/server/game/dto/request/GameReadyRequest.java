package com.teacat.server.game.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "대기실 준비 상태")
public record GameReadyRequest(

        @Schema(description = "준비 완료 여부", example = "true")
        boolean ready) {
}
