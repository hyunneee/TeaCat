package com.teacat.server.sticker.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 스티커 생성 요청.
 *
 * <p>🔴 파일이 아니라 <b>캔버스가 만든 PNG 의 base64</b> 다. 프론트가 {@code toDataURL()} 로
 * 만들어 보내므로 {@code data:image/png;base64,} 접두어가 붙어 올 수 있다 — 서버가 벗긴다.
 */
@Schema(description = "스티커 생성 요청")
public record StickerCreateRequest(

        @Schema(description = "낙서 PNG 의 base64. data URL 접두어가 붙어 있어도 됩니다",
                example = "iVBORw0KGgoAAAANSUhEUg...", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "낙서가 비어 있습니다.")
        String sketchBase64,

        /* 첫 시도에는 보통 비어 있다. 워커의 캡셔너가 낙서를 읽어 주제를 채우고,
           그게 틀렸을 때만 사용자가 적어 다시 돌린다. */
        @Schema(description = "주제. 결과가 엉뚱할 때 다시 만들면서 알려 줍니다", example = "고양이")
        @Size(max = 20, message = "주제는 20자까지 입력할 수 있습니다.")
        String subject,

        @Schema(description = "같은 낙서로 다른 결과를 내는 값. 생략하면 서버가 뽑습니다", example = "12345")
        Integer seed
) {
}
