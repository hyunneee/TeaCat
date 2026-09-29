package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftPhotocardDecoration;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.Map;

/**
 * 꾸민 카드 한 장.
 *
 * <p>{@code imageUrl} 은 공개 고정 주소다(2026-09-29 이전에 저장된 것만 presigned).
 * {@code stickerImageUrls} 는 presigned 라 <b>만료된다</b> — 둘 다 조회할 때마다 만든다
 * ({@code NftDecorationImageResolver}).
 */
@Schema(description = "꾸민 카드")
public record NftDecorationResponse(

        @Schema(description = "꾸민 카드 이미지 URL (공개 고정 주소, 예전 꾸밈은 presigned)")
        String imageUrl,

        @Schema(description = "스티커 배치 정보(JSON 배열 문자열). 다시 꾸밀 때 그대로 복원합니다")
        String placements,

        /*
         * 🔴 배치에는 stickerId 만 있고 <b>그림 주소가 없다.</b> 그래서 여기에 함께 실어 준다.
         *
         * ⚠️ 없던 시절에는 화면이 "내 스티커 목록" 에서 주소를 찾아 썼고, 그래서
         *    <b>카드를 산 사람에게는 붙어 있던 스티커가 통째로 안 보였다</b> — 그 스티커들은
         *    판 사람 것이라 산 사람의 목록에 없다. 원래 주인일 때만 우연히 맞던 구조였다
         *    (2026-09-23).
         *
         * 🔴 배치 JSON 을 다시 읽어 만들지 않고 <b>DB 가 아는 것</b>(stickers.used_photocard_id)
         *    으로 만든다. 무엇이 이 카드에 붙어 있는지의 진실은 그쪽이다.
         */
        @Schema(description = "붙어 있는 스티커의 그림 URL. 키는 stickerId (presigned)")
        Map<Long, String> stickerImageUrls
) {

    public static NftDecorationResponse of(
            NftPhotocardDecoration decoration, String imageUrl, Map<Long, String> stickerImageUrls) {
        return new NftDecorationResponse(imageUrl, decoration.getPlacements(), stickerImageUrls);
    }
}
