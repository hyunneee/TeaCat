package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * application.yaml 의 booking.resale.* 설정 — 취소표 추첨.
 *
 * @param paymentWindow   당첨자가 결제를 마쳐야 하는 시간. 프론트 {@code RESALE_PAYMENT_HOURS}(12) 와 맞춘다
 * @param sweepEnabled    추첨 스위퍼 켬/끔. 테스트에서 끈다
 * @param sweepInterval   스위퍼 주기. @Scheduled 문자열로도 쓰이므로 ISO-8601(PT15S) 로 적는다
 * @param batchSize       한 주기에 처리할 최대 추첨·당첨 건수
 * @param openRetryAfter  커밋을 보내지 못한 채(PENDING) 또는 보냈는데 체인에 없는 채(OPEN) 이 시간이 지나면 다시 보낸다
 * @param revealTimeout   커밋 후 이 시간이 지나도 난수가 확정되지 않으면 그 추첨을 접고 새 키로 다시 연다.
 *                        블록해시 창(256블록 ≈ 42분)보다 길어야 한다
 */
@ConfigurationProperties(prefix = "booking.resale")
public record ResaleProperties(
        Duration paymentWindow,
        boolean sweepEnabled,
        Duration sweepInterval,
        int batchSize,
        Duration openRetryAfter,
        Duration revealTimeout
) {
}
