package com.teacat.server.sticker.dto.response;

import com.teacat.server.sticker.entity.Sticker;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;

/**
 * 스티커 한 장.
 *
 * <p>{@code imageUrl} 은 presigned URL 이라 만료된다. 저장하지 말고 조회할 때마다 받을 것.
 */
@Schema(description = "스티커")
public record StickerResponse(

        @Schema(description = "스티커 id", example = "12")
        Long id,

        @Schema(description = "투명 PNG 의 임시 조회 주소 (만료됨)")
        String imageUrl,

        @Schema(description = "만들어진 시각")
        OffsetDateTime createdAt
) {

    public static StickerResponse of(Sticker sticker, String imageUrl) {
        return new StickerResponse(sticker.getId(), imageUrl, sticker.getCreatedAt());
    }
}
