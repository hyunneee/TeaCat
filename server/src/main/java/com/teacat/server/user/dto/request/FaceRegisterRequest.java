package com.teacat.server.user.dto.request;

import com.teacat.server.user.entity.Face;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 얼굴 정보 등록 요청.
 *
 * 얼굴 원본 이미지는 받지 않는다. 특징값 추출은 클라이언트(브라우저)에서 끝내고
 * 512 차원 임베딩만 보낸다.
 */
@Schema(description = "얼굴 정보 등록 요청")
public record FaceRegisterRequest(

        @Schema(description = "클라이언트에서 추출한 512 차원 얼굴 임베딩")
        @NotNull(message = "얼굴 특징값을 입력해 주세요.")
        @Size(min = Face.EMBEDDING_DIMENSION, max = Face.EMBEDDING_DIMENSION, message = "얼굴 특징값은 512 차원이어야 합니다.")
        float[] embedding
) {
}
