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
        OffsetDateTime createdAt,

        /* 🔴 소모는 **되돌릴 수 없다.** 꾸미기 "완료하기" 를 누르면 그 스티커는 카드에 붙어
           다시 쓸 수 없고, 카드가 팔리면 카드를 따라간다. 화면은 이 값으로 "사용됨" 을 보여준다. */
        @Schema(description = "꾸미기에 이미 썼는지. true 면 다시 쓸 수 없습니다")
        boolean used,

        @Schema(description = "붙어 있는 카드 id. 안 썼으면 null")
        Long usedPhotocardId
) {

    public static StickerResponse of(Sticker sticker, String imageUrl) {
        return new StickerResponse(sticker.getId(), imageUrl, sticker.getCreatedAt(),
                sticker.isUsed(), sticker.getUsedPhotocardId());
    }
}
