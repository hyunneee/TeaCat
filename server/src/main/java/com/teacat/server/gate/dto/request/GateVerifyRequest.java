package com.teacat.server.gate.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 현장 검표 요청 — 지금 카메라 앞에 선 사람이 이 회차의 누구인지 묻는다.
 *
 * <p>🔴 <b>이미지가 아니다.</b> 브라우저에서 뽑은 임베딩만 온다
 * (client/CLAUDE.md 7장 · server/CLAUDE.md 6장). 이 DTO 에
 * {@code MultipartFile}·base64·dataURL 을 받는 필드를 추가하면 규칙 위반이다.
 *
 * <p><b>왜 여러 장인가 — 이게 "움직여도 통과시키는" 장치다.</b> 같은 사람도 조명·각도·거리에
 * 따라 유사도가 0.4~0.7 사이로 흩어진다. 한 프레임만 보면 그 흩어짐이 그대로 판정이 되어,
 * 본인이 하필 흔들린 순간에 찍혔다는 이유로 거절당한다.
 *
 * <p>그래서 클라이언트가 품질 게이트({@code checkFaceQuality})를 통과한 프레임 중 몇 장을
 * 모아 한 번에 보내고, <b>서버는 각각 대조해 가장 높은 점수를 쓴다</b>(best-of-N).
 *
 * <p>🔴 <b>평균을 내서 보내지 마세요.</b> 흔들린 프레임이 섞이면 평균도 같이 나빠진다.
 * 여러 장을 <b>그대로</b> 보내고 최댓값을 고르는 편이 언제나 낫다. (등록 시점의 centroid 는
 * 다른 이야기다 — 거기는 협조적인 환경에서 찍은 좋은 프레임만 모은다)
 *
 * <p>왕복은 한 번이다. 5장이어도 약 7.5KB 라, 사람이 줄 서 있는 경로에서 서버를 다섯 번
 * 부르는 것보다 훨씬 낫다.
 */
@Schema(description = "현장 검표 요청")
public record GateVerifyRequest(

        @Schema(description = """
                지금 촬영한 얼굴들의 128 차원 임베딩 (L2 정규화). 품질 게이트를 통과한
                프레임만 담아 보내세요. 서버는 각각 대조해 **가장 높은 점수**를 씁니다.
                """)
        @NotEmpty(message = "얼굴 특징값을 입력해 주세요.")
        @Size(max = 5, message = "한 번에 5장까지만 보낼 수 있습니다.")
        List<float[]> embeddings,

        @Schema(description = "임베딩을 뽑은 모델 버전. 이 값이 같은 티켓끼리만 대조됩니다.",
                example = "yunet2023mar+sface2021dec-int8@1")
        @NotBlank(message = "모델 버전을 입력해 주세요.")
        @Size(max = 50, message = "모델 버전은 50자를 넘을 수 없습니다.")
        String modelVersion
) {

    /*
     * 🔴 toString 을 만들지 마세요. embeddings 는 생체 특징값이고, 이 record 가 예외 메시지나
     *    디버그 로그에 실리면 그대로 찍힌다 — ERROR 로그는 Sentry 로 나간다(server/CLAUDE.md 9장).
     *    record 의 기본 toString 은 float[] 를 주소로 찍으므로 지금은 안전하다.
     *    @ToString 을 붙이거나 List<Float> 로 바꾸면 그 안전장치가 사라진다.
     */
}
