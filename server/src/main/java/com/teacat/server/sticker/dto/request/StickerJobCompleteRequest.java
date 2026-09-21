package com.teacat.server.sticker.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

import java.util.Map;

/**
 * 워커가 보내는 결과.
 *
 * <p>{@code meta} 는 선택이다. 노트북이 이미 {@code {seed, verdict, secs}} 를 만들고 있어
 * 받아서 {@code sticker_jobs.params_json} 에 남긴다 — 나중에 "이 스티커가 어떤 설정으로
 * 나왔나" 를 물어볼 수 있어야 튜닝이 감으로 가지 않는다. 서버는 읽지 않는다.
 */
@Schema(description = "워커가 보내는 생성 결과")
public record StickerJobCompleteRequest(

        @Schema(description = "결과 PNG 의 base64", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "결과 이미지가 비어 있습니다.")
        String imageBase64,

        @Schema(description = "워커가 남기는 기록. 없어도 됩니다")
        Map<String, Object> meta
) {
}
