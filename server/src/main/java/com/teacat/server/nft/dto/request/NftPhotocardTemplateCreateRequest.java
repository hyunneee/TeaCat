package com.teacat.server.nft.dto.request;

import com.teacat.server.nft.entity.NftPhotocardGrade;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.web.multipart.MultipartFile;

/**
 * 포토카드 템플릿 등록 요청 (multipart/form-data).
 *
 * <p><b>수량이 없다.</b> 템플릿은 그림이고, 몇 장 발행할지는 공연·이벤트에 넣을 때 정한다.
 * 그래서 이 요청은 <b>이미지 핀 한 번</b>으로 끝나고 온체인 등록이 나가지 않는다.
 */
@Schema(description = "포토카드 템플릿 등록 요청 (multipart/form-data)")
public record NftPhotocardTemplateCreateRequest(

        @Schema(description = "카드 이름. 도안을 만들 때 여기에 공연 제목이 붙는다", example = "김예린")
        @NotBlank(message = "카드 이름을 입력해 주세요.")
        @Size(max = 100, message = "카드 이름은 100자 이하여야 합니다.")
        String name,

        @Schema(description = "설명. 메타데이터 JSON 에 들어간다 (생략 가능)",
                example = "2026 단독 콘서트 기념")
        @Size(max = 500, message = "설명은 500자 이하여야 합니다.")
        String description,

        @Schema(description = "카드 이미지 (jpg/png/webp/gif)")
        @NotNull(message = "카드 이미지를 올려 주세요.")
        MultipartFile image,

        @Schema(description = "소속. 화면 문구에 쓴다", example = "서울 5반")
        @NotBlank(message = "소속을 입력해 주세요.")
        @Size(max = 50, message = "소속은 50자 이하여야 합니다.")
        String group,

        @Schema(description = "연출 등급", example = "SPECIAL")
        @NotNull(message = "등급을 선택해 주세요.")
        NftPhotocardGrade grade
) {
}
