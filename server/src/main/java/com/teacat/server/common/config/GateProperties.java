package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application.yaml 의 gate.* 설정 — 현장 검표 (GATE_PLAN.md).
 *
 * <p>🔴 <b>{@code enabled} 는 기본이 false 다.</b> 컨트롤러가
 * {@code @ConditionalOnProperty} 로 이 값을 보므로, 꺼 두면 빈이 뜨지 않아 엔드포인트가
 * 존재하지 않는다. 코드는 그대로 컴파일되고 테스트도 돈다 — 주석으로 막지 않는 이유다.
 *
 * <p><b>임계값을 설정으로 둔 이유</b>는 현장에서 조정해야 하기 때문이다. 줄이 밀리면 낮추고,
 * 오인이 보이면 높인다. 코드에 박아 두면 그때마다 배포해야 한다.
 *
 * <p>한 요청에 받을 임베딩 최대 개수(best-of-N)는 여기 두지 않았다. Bean Validation 은 상수만
 * 받으므로 {@code GateVerifyRequest} 의 {@code @Size} 가 그 한도를 정한다 — 두 곳에 적으면 갈라진다.
 *
 * @param enabled   검표 API 를 열지. 기본 false
 * @param threshold 판정 경계값
 */
@ConfigurationProperties(prefix = "gate")
public record GateProperties(
        boolean enabled,
        Threshold threshold
) {

    /**
     * 통과 / 보류 / 거절을 가르는 값.
     *
     * <p>🔴 <b>지금 값은 자리를 채워 둔 것이다.</b> 실제 사람들로 재보기 전의 숫자라
     * 근거가 없다. {@code /dev/face} 화면으로 조명·각도·거리별 분포를 찍어 FRR(본인 거절률)과
     * FAR(오인 통과율)을 보고 정해야 한다 (GATE_PLAN.md 8-3).
     *
     * <p>참고로 SFace 공식 권장 코사인 임계값은 <b>0.363</b> 이고(OpenCV Zoo), 1:1 본인확인은
     * {@code Face.SAME_PERSON_THRESHOLD = 0.65} 다. 1:N 은 후보가 늘수록 "남인데 우연히 닮은
     * 1등" 이 나올 확률이 커지므로 1:1 보다 높게 잡는다.
     *
     * @param match  1등이 이 값 이상이고 마진도 넘으면 통과
     * @param review 1등이 이 값 이상이면 운영자가 육안으로 본다. 그 아래는 거절
     * @param margin 1등과 2등의 간격. 좁으면 누구인지 모르는 것이므로 통과시키지 않는다
     */
    public record Threshold(double match, double review, double margin) {
    }
}
