package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "커서 기반 페이지 응답")
public record NftCursorPageResponse<T>(

        @Schema(description = "현재 페이지 항목")
        List<T> items,

        @Schema(description = "다음 페이지 커서. 마지막 페이지이면 null")
        String nextCursor,

        @Schema(description = "다음 페이지 존재 여부", example = "true")
        boolean hasNext
) {
}

