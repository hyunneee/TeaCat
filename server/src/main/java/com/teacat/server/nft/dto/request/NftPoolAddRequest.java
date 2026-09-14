package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

@Schema(description = "뽑기 풀에 템플릿을 넣는 요청")
public record NftPoolAddRequest(

        @Schema(description = "체크한 템플릿들. 각각 몇 장인지 함께 보낸다")
        @NotEmpty(message = "넣을 카드를 하나 이상 선택해 주세요.")
        // 🔴 Q1: 항목마다 IPFS 핀 + 온체인 트랜잭션이 나가고 둘 다 되돌릴 수 없다. 상한이 없으면
        // 수백 개를 보냈을 때 요청은 타임아웃돼도 서버는 계속 올려, 통제 없이 되돌릴 수 없는
        // 작업이 나간다.
        @Size(max = 50, message = "한 번에 50개까지 넣을 수 있습니다.")
        @Valid
        List<Item> items
) {

    @Schema(description = "템플릿 하나와 수량")
    public record Item(

            @Schema(description = "템플릿 ID", example = "3")
            @NotNull(message = "템플릿 ID를 보내 주세요.")
            @Positive(message = "템플릿 ID가 올바르지 않습니다.")
            Long templateId,

            @Schema(description = "한정 수량. 온체인 maxSupply 로 박히고 첫 장 발급 시 동결된다",
                    example = "20")
            @NotNull(message = "한정 수량을 입력해 주세요.")
            @Positive(message = "한정 수량은 1 이상이어야 합니다.")
            @Max(value = 100_000, message = "한정 수량은 100,000 이하여야 합니다.")
            Integer totalSupply
    ) {
    }
}
