package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftPhotocardDesign;
import com.teacat.server.nft.entity.NftPhotocardGrade;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 도감 한 칸 — <b>뽑기에서 나올 수 있는 카드</b> 한 종류.
 *
 * <p>🔴 {@link NftPhotocardDesignResponse}(어드민)와 <b>일부러 다른 DTO</b>다. 저쪽에는
 * 남은 수량 · 발급 수량 · CID · 온체인 등록 상태가 들어 있다. 도감은 "무엇을 모을 수 있나" 만
 * 답하면 되고, <b>몇 장 남았는지는 운영 정보</b>다 — 내려주면 남은 수량을 보고 뽑기 시점을
 * 고르는 식으로 쓰이게 된다.
 *
 * <p>{@code group} 은 역할(코치·교육생·개발자)을 읽는 근거다 — 화면이 꼬리표를 떼어 씁니다
 * ({@code pocaRole}). 서버가 역할을 따로 계산해 주지 않는 이유는, 그 규칙이 지금도 바뀌는
 * 중이고 옛 카드에는 꼬리표가 없어 <b>화면이 폴백을 갖고 있기</b> 때문이다.
 */
@Schema(description = "도감 카드 (뽑기 풀 도안)")
public record NftDrawPoolCardResponse(

        @Schema(description = "도안 ID. 보유 여부를 이 값으로 맞춥니다", example = "11")
        Long designId,

        @Schema(description = "카드 이름", example = "김예린")
        String name,

        @Schema(description = "이미지 주소 (게이트웨이)")
        String imageUrl,

        @Schema(description = "소속. 역할 꼬리표가 붙어 있습니다", example = "서울 5반 · 코치")
        String group,

        @Schema(description = "연출 등급", example = "SPECIAL")
        NftPhotocardGrade grade
) {

    public static NftDrawPoolCardResponse from(NftPhotocardDesign design) {
        return new NftDrawPoolCardResponse(
                design.getId(), design.getName(), design.getImageUrl(),
                design.getGroupName(), design.getGrade());
    }
}
