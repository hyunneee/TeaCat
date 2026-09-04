package com.teacat.server.payment.client;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * application.yaml 의 payment.toss.* 설정.
 *
 * 🔴 secret-key 는 설정 파일에 적지 않고 환경변수(TOSS_SECRET_KEY)로만 주입한다.
 * 이 키 하나로 승인·취소가 모두 가능하므로 <b>프론트로 절대 내려가면 안 된다.</b>
 * (프론트가 쓰는 것은 공개값인 클라이언트 키다)
 *
 * @param readTimeout 승인 API 는 카드사까지 다녀오므로 넉넉해야 한다. 짧게 잡고 끊으면
 *                    "토스는 승인했는데 우리는 실패로 아는" 최악의 상태가 잦아진다
 */
@ConfigurationProperties(prefix = "payment.toss")
public record TossPaymentsProperties(
        String baseUrl,
        String secretKey,
        Duration connectTimeout,
        Duration readTimeout
) {

    public boolean isConfigured() {
        return baseUrl != null && !baseUrl.isBlank()
                && secretKey != null && !secretKey.isBlank();
    }
}
