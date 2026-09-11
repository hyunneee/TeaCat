package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftDesignChainStatus;
import com.teacat.server.nft.entity.NftPhotocardDesign;
import com.teacat.server.nft.entity.NftPhotocardGrade;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 도안 한 건. 어드민이 <b>등록이 어디까지 갔는지</b> 보는 화면용이다.
 *
 * @param imageUrl    브라우저가 여는 주소(게이트웨이). {@code ipfs://} 는 브라우저가 못 연다
 * @param metadataUri 온체인 {@code uri(tokenId)} 가 돌려주는 값. 지갑이 실제로 보는 주소다
 */
@Schema(description = "포토카드 도안")
public record NftPhotocardDesignResponse(

        @Schema(description = "도안 ID. 이 값이 그대로 온체인 tokenId 다", example = "11")
        Long designId,

        @Schema(description = "공연 ID. 뽑기 풀 도안이면 null", example = "1")
        Long performanceId,

        @Schema(description = "뽑기 풀 도안인가")
        boolean drawPool,

        @Schema(description = "이 도안을 만든 템플릿 ID. 템플릿 없이 직접 등록된 기존 도안은 null",
                example = "3")
        Long templateId,

        @Schema(description = "남은 수량 (totalSupply - issuedSupply)", example = "18")
        int remaining,

        @Schema(description = "소속 (뽑기 풀 도안만)", example = "서울 5반")
        String group,

        @Schema(description = "연출 등급 (뽑기 풀 도안만)", example = "SPECIAL")
        NftPhotocardGrade grade,

        @Schema(description = "도안 이름", example = "티캣 콘서트 포토카드 A")
        String name,

        @Schema(description = "이미지 주소 (IPFS 게이트웨이)")
        String imageUrl,

        @Schema(description = "한정 수량 (온체인 maxSupply)", example = "100")
        int totalSupply,

        @Schema(description = "지금까지 발급한 수량", example = "0")
        int issuedSupply,

        @Schema(description = "이미지 CID", example = "bafybeigdyrzt5…")
        String imageCid,

        @Schema(description = "메타데이터 CID. 체인에 올라가는 값은 이것 하나다")
        String metadataCid,

        @Schema(description = "온체인 메타데이터 주소", example = "ipfs://bafybeigdyrzt5…")
        String metadataUri,

        @Schema(description = "온체인 등록 상태", example = "REGISTERED")
        NftDesignChainStatus chainStatus,

        @Schema(description = "등록한 체인 ID", example = "31221")
        Integer chainId,

        @Schema(description = "PhotocardNFT 컨트랙트 주소")
        String contractAddress,

        @Schema(description = "등록 트랜잭션 해시")
        String registerTxHash,

        @Schema(description = "등록이 확정된 시각")
        LocalDateTime registeredAt
) {

    private static final String IPFS_SCHEME = "ipfs://";

    public static NftPhotocardDesignResponse from(NftPhotocardDesign design) {
        return new NftPhotocardDesignResponse(
                design.getId(),
                design.getPerformanceId(),
                design.isDrawPool(),
                design.getTemplateId(),
                design.remaining(),
                design.getGroupName(),
                design.getGrade(),
                design.getName(),
                design.getImageUrl(),
                design.getTotalSupply(),
                design.getIssuedSupply(),
                design.getImageCid(),
                design.getMetadataCid(),
                design.getMetadataCid() == null ? null : IPFS_SCHEME + design.getMetadataCid(),
                design.getChainStatus(),
                design.getChainId(),
                design.getContractAddress(),
                design.getRegisterTxHash(),
                design.getRegisteredAt());
    }
}
