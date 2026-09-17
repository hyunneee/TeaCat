package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftPhotocardTemplate;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 카드 그림 한 장 — <b>일반 사용자에게 나가는 템플릿</b>.
 *
 * <p>🔴 {@link NftPhotocardTemplateResponse}(어드민)와 <b>일부러 다른 DTO</b>다.
 * 저쪽에는 {@code hidden} · {@code usedCount}(몇 장 발행했는지) · {@code createdAt} 처럼
 * 운영자만 알면 되는 값이 들어 있다. 어드민 DTO 를 그대로 재사용하면 나중에 운영용 필드를
 * 하나 더 붙였을 때 <b>그게 조용히 사용자에게도 나간다.</b>
 *
 * <p>여기 있는 것은 이미 마켓·뽑기 화면에 그대로 보이는 값뿐이다 — 이름과 그림 주소.
 */
@Schema(description = "카드 그림")
public record NftPhotocardArtResponse(

        @Schema(description = "템플릿 ID", example = "1") Long templateId,
        @Schema(description = "카드 이름", example = "김예린") String name,
        @Schema(description = "이미지 주소 (게이트웨이)") String imageUrl
) {

    public static NftPhotocardArtResponse from(NftPhotocardTemplate template) {
        return new NftPhotocardArtResponse(
                template.getId(), template.getName(), template.getImageUrl());
    }
}
