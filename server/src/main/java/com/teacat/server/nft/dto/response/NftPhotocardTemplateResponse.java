package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftPhotocardGrade;
import com.teacat.server.nft.entity.NftPhotocardTemplate;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "포토카드 템플릿")
public record NftPhotocardTemplateResponse(

        @Schema(description = "템플릿 ID", example = "1") Long templateId,
        @Schema(description = "카드 이름", example = "김예린") String name,
        @Schema(description = "설명", example = "2026 단독 콘서트 기념") String description,
        @Schema(description = "이미지 주소 (게이트웨이)") String imageUrl,
        @Schema(description = "소속", example = "서울 5반") String group,
        @Schema(description = "연출 등급", example = "SPECIAL") NftPhotocardGrade grade,
        @Schema(description = "목록에서 감춰졌는가", example = "false") boolean hidden,
        @Schema(description = "이 템플릿으로 만든 도안 수 (공연 + 이벤트 합계)", example = "3")
        long usedCount,
        @Schema(description = "등록 시각") LocalDateTime createdAt
) {

    public static NftPhotocardTemplateResponse of(NftPhotocardTemplate template, long usedCount) {
        return new NftPhotocardTemplateResponse(
                template.getId(), template.getName(), template.getDescription(),
                template.getImageUrl(), template.getGroupName(), template.getGrade(),
                template.isHidden(), usedCount, template.getCreatedAt());
    }
}
