package com.teacat.server.stadium.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

@Schema(description = "구역과 초기 좌석 일괄 생성 요청")
public record AreaBatchCreateRequest(
        @Schema(description = "생성할 구역 목록")
        @NotEmpty List<@Valid AreaCreateRequest> areas
) {
}
