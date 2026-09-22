package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftPhotocardDecoration;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 꾸민 카드 한 장.
 *
 * <p>{@code imageUrl} 은 presigned 라 <b>만료된다.</b> DB 에 담아 두지 않고 조회할 때마다
 * 새로 만든다 ({@code NftDecorationImageResolver}).
 */
@Schema(description = "꾸민 카드")
public record NftDecorationResponse(

        @Schema(description = "꾸민 카드 이미지 URL (presigned)")
        String imageUrl,

        @Schema(description = "스티커 배치 정보(JSON 배열 문자열). 다시 꾸밀 때 그대로 복원합니다")
        String placements
) {

    public static NftDecorationResponse of(NftPhotocardDecoration decoration, String imageUrl) {
        return new NftDecorationResponse(imageUrl, decoration.getPlacements());
    }
}
