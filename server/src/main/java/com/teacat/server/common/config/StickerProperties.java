package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;
import org.springframework.util.unit.DataSize;

import java.time.Duration;

/**
 * application.yaml 의 sticker.* 설정.
 *
 * @param dailyLimit     하루에 만들 수 있는 장수. 🔴 실패한 작업은 세지 않는다 (워커 장애로 몫이 깎이면 안 된다)
 * @param internalApiKey 워커 인증 키. 🔴 비어 있으면 워커 API 가 <b>어떤 요청도</b> 받지 않는다
 * @param maxSketchSize  낙서 PNG 상한. base64 가 아니라 디코드한 바이트 기준
 * @param maxResultSize  결과 PNG 상한
 * @param claimTimeout   워커가 집어간 뒤 이만큼 소식이 없으면 죽은 것으로 본다
 * @param pendingTimeout 아무도 집어가지 않은 작업을 포기하는 시점. 워커가 안 떠 있는 경우다
 * @param maxRetry       되돌림 횟수 상한. 넘으면 FAILED
 * @param sweepInterval  스위퍼 주기. {@code @Scheduled} 가 그대로 읽으므로 ISO-8601(PT…) 표기여야 한다
 * @param sweepEnabled   스위퍼 켬/끔. 테스트에서 끈다 — 정리는 테스트가 직접 불러 검증한다
 */
@ConfigurationProperties(prefix = "sticker")
public record StickerProperties(
        int dailyLimit,
        /** 하루 무료 몫을 넘겨 만들 때 1장당 태우는 캣머니 (2026-09-23) */
        int extraPriceCat,
        String internalApiKey,
        DataSize maxSketchSize,
        DataSize maxResultSize,
        Duration claimTimeout,
        Duration pendingTimeout,
        int maxRetry,
        Duration sweepInterval,
        boolean sweepEnabled
) {

    /**
     * 🔴 키가 설정돼 있는가. 없으면 워커 API 를 전면 거절한다.
     *
     * <p>빈 키를 빈 헤더가 통과하게 두면 {@code /internal/**} 이 스프링 시큐리티를 그냥
     * 지나가므로 인터넷에 열린 API 가 된다.
     */
    public boolean hasInternalApiKey() {
        return StringUtils.hasText(internalApiKey);
    }
}
