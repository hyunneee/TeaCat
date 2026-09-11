package com.teacat.server.user.dto.request;

import com.teacat.server.user.entity.Face;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 본인 확인 요청 — 지금 카메라에 있는 얼굴이 등록해 둔 얼굴과 같은 사람인지 묻는다.
 *
 * <p>등록({@link FaceRegisterRequest})과 같은 모양이다. 원본 이미지는 받지 않고, 브라우저에서
 * 뽑은 임베딩만 온다.
 *
 * <p><b>대조는 서버가 한다.</b> 저장해 둔 임베딩을 클라이언트로 내려보내 거기서 비교하게 하면
 * 생체 특징값이 브라우저까지 나가고, 판정도 클라이언트가 하게 되어 결과를 꾸며낼 수 있다.
 */
@Schema(description = "얼굴 본인 확인 요청")
public record FaceVerifyRequest(

        @Schema(description = "지금 촬영한 얼굴의 128 차원 임베딩 (L2 정규화)")
        @NotNull(message = "얼굴 특징값을 입력해 주세요.")
        @Size(min = Face.EMBEDDING_DIMENSION, max = Face.EMBEDDING_DIMENSION,
                message = "얼굴 특징값은 128 차원이어야 합니다.")
        float[] embedding,

        @Schema(description = "임베딩을 뽑은 모델 버전", example = "yunet2023mar+sface2021dec-int8@1")
        @NotBlank(message = "모델 버전을 입력해 주세요.")
        @Size(max = 50, message = "모델 버전은 50자를 넘을 수 없습니다.")
        String modelVersion
) {
}
