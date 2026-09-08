package com.teacat.server.stadium.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "공연장 등록 응답")
public record StadiumCreateResponse(
        @Schema(description = "생성된 공연장 ID", example = "1") Long stadiumId,
        @Schema(description = "요청자가 해당 공연장의 소유 관리자인지 여부", example = "true")
        boolean managedByRequester
) {
}
