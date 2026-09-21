package com.teacat.server.ticket.dto.request;

import com.teacat.server.user.entity.Face;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * 게이트에서 얼굴을 대조하고 입장 처리한다.
 *
 * <p>🔴 <b>원본 이미지는 오지 않는다.</b> 검표기(브라우저)에서 뽑은 임베딩만 온다 —
 * 회원 본인 확인({@code FaceVerifyRequest})과 같은 규칙이다 (client/CLAUDE.md 7장).
 *
 * <p>🔴 <b>대조도 판정도 서버가 한다.</b> 티켓에 베껴 둔 임베딩을 검표기로 내려보내
 * 거기서 비교하게 하면 생체 특징값이 기기로 나가고, 콘솔에서 결과를 뒤집을 수 있다.
 */
@Schema(description = "입장 확인 - 얼굴 대조 요청")
public record CheckInVerifyRequest(

        @Schema(description = "QR 에서 읽은 문자열. 번호를 직접 넣었다면 생략합니다.")
        String qrToken,

        @Schema(description = "티켓 번호. QR 을 찍었다면 생략합니다.", example = "1")
        @Positive(message = "티켓 번호가 올바르지 않습니다.")
        Long ticketId,

        @Schema(description = "지금 검표 중인 회차 ID", example = "1")
        @NotNull(message = "회차를 선택해 주세요.")
        @Positive(message = "회차가 올바르지 않습니다.")
        Long performanceDetailId,

        @Schema(description = "게이트에서 촬영한 얼굴의 128 차원 임베딩 (L2 정규화)")
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
