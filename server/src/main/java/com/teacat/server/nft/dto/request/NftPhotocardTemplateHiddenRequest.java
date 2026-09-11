package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "템플릿 감추기/되살리기 요청")
public record NftPhotocardTemplateHiddenRequest(

        @Schema(description = "true 면 목록에서 감춘다. 이미 만든 도안은 그대로 동작한다",
                example = "true")
        @NotNull(message = "hidden 값을 보내 주세요.")
        Boolean hidden
) {
}
