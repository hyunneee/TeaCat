package com.teacat.server.user.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 본인 확인 결과.
 *
 * <p>{@code similarity} 를 함께 내려주는 건 <b>지금이 검증 단계이기 때문</b>이다. 임계값을
 * 실제 사람들 얼굴로 맞춰보려면 붙었는지 떨어졌는지만으로는 알 수 없고, 같은 사람이 몇 점에서
 * 걸리는지를 봐야 한다.
 *
 * <p>🔴 <b>운영에 올릴 때는 점수를 빼는 걸 검토하세요.</b> 점수가 보이면 남의 얼굴로 여러 번
 * 시도하며 어느 방향이 더 가까운지 더듬어 볼 수 있습니다 — 임계값을 넘길 때까지 조명·각도를
 * 조절하는 식입니다. 판정({@code match})만 내려주면 그 단서가 사라집니다.
 */
@Schema(description = "얼굴 본인 확인 결과")
public record FaceVerifyResponse(

        @Schema(description = "같은 사람으로 판정했는가", example = "true")
        boolean match,

        @Schema(description = "코사인 유사도 (-1 ~ 1). 검증용 값이다", example = "0.5821")
        double similarity,

        @Schema(description = "이 값 이상이면 같은 사람으로 본다", example = "0.363")
        double threshold
) {

    public static FaceVerifyResponse of(double similarity, double threshold) {
        return new FaceVerifyResponse(similarity >= threshold, round(similarity), threshold);
    }

    /** 소수점 넷째 자리까지. 그 아래는 조명만 바뀌어도 흔들리는 자리라 의미가 없다 */
    private static double round(double value) {
        return Math.round(value * 10_000d) / 10_000d;
    }
}
