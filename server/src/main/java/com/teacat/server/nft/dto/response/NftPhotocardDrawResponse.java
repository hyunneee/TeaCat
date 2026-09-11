package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftPhotocardGrade;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/** 뽑기 결과 한 장. 화면 연출이 group·grade 를 본다 */
public record NftPhotocardDrawResponse(
        @Schema(description = "포토카드 ID", example = "1024") Long photocardId,
        @Schema(description = "도안명", example = "김예린") String designName,
        @Schema(description = "이미지 URL (IPFS 게이트웨이)") String imageUrl,
        @Schema(description = "소속", example = "서울 5반") String group,
        @Schema(description = "연출 등급", example = "SPECIAL") NftPhotocardGrade grade,
        @Schema(description = "발행 시각") LocalDateTime issuedAt
) {
}
