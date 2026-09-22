package com.teacat.server.nft.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.teacat.server.nft.entity.NftPhotocardGrade;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "숨김되지 않은 원본 템플릿 기준의 사용자 도감")
public record NftTemplateDexResponse(List<Card> cards, long pendingCount) {
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Card(
            @Schema(description = "원본 템플릿 ID") Long templateId,
            boolean owned,
            @Schema(description = "미보유이면 null") String name,
            @Schema(description = "미보유이면 null") String imageUrl,
            @Schema(description = "미보유이면 null") String group,
            @Schema(description = "미보유이면 null") NftPhotocardGrade grade,
            @Schema(description = "공개된 획득처. 풀 등록 전이면 빈 배열")
            List<NftPocaDexResponse.Acquisition> acquisitions,
            int count, int marketCount,
            MyNftPhotocardSummaryResponse.MarketState marketState,
            @Schema(description = "상세로 이동할 실제 카드 ID") Long photocardId) {}
}
