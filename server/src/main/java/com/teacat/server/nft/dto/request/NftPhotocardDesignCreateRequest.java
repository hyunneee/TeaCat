package com.teacat.server.nft.dto.request;

import com.teacat.server.nft.entity.NftPhotocardGrade;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.web.multipart.MultipartFile;

/**
 * 포토카드 도안 등록 요청 (multipart/form-data).
 *
 * <p>그림 바이트를 그대로 받아야 해서 multipart 다. 이 요청 하나가 <b>IPFS 핀 두 번 →
 * 도안 행 저장 → 온체인 등록</b>까지 간다.
 */
@Schema(description = "포토카드 도안 등록 요청 (multipart/form-data)")
public record NftPhotocardDesignCreateRequest(

        @Schema(description = "공연 ID. 뽑기 풀 도안(drawPool=true)이면 비운다", example = "1")
        Long performanceId,

        @Schema(description = "도안 이름. 지갑에 그대로 뜬다", example = "티캣 콘서트 포토카드 A")
        @NotBlank(message = "도안 이름을 입력해 주세요.")
        @Size(max = 100, message = "도안 이름은 100자 이하여야 합니다.")
        String name,

        @Schema(description = "도안 설명. 메타데이터 JSON 에만 들어가고 DB 에는 저장하지 않는다 (생략 가능)",
                example = "2026 단독 콘서트 기념 한정 포토카드")
        @Size(max = 500, message = "도안 설명은 500자 이하여야 합니다.")
        String description,

        /*
         * 이 값이 온체인 maxSupply 가 된다. 첫 장이 나가는 순간 동결되어 아무도 못 바꾼다 —
         * "한정 100장" 은 약관이 아니라 컨트랙트가 지키는 약속이 된다.
         */
        @Schema(description = "한정 수량. 온체인 maxSupply 로 박힌다", example = "100")
        @NotNull(message = "한정 수량을 입력해 주세요.")
        @Positive(message = "한정 수량은 1 이상이어야 합니다.")
        @Max(value = 100_000, message = "한정 수량은 100,000 이하여야 합니다.")
        Integer totalSupply,

        @Schema(description = "도안 이미지 (jpg/png/webp/gif)")
        MultipartFile image,

        @Schema(description = "사용하지 않습니다. 뽑기 풀 카드는 템플릿 경로로 만드세요 "
                + "(POST /admin/photocard-templates → POST /admin/performances/{id}/draw-designs). "
                + "true 로 보내면 NFT_042 로 거절됩니다",
                deprecated = true, example = "false")
        Boolean drawPool,

        @Schema(description = "소속 (뽑기 풀 도안만). 화면 문구에 쓴다", example = "서울 5반")
        @Size(max = 50, message = "소속은 50자 이하여야 합니다.")
        String group,

        @Schema(description = "연출 등급 (뽑기 풀 도안만)", example = "SPECIAL")
        NftPhotocardGrade grade
) {

    public boolean isDrawPool() {
        return Boolean.TRUE.equals(drawPool);
    }
}
