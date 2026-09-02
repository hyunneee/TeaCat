package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * application.yaml 의 cors.* 설정.
 *
 * 리프레시 토큰 쿠키를 주고받으려면 allowCredentials 가 켜져 있어야 하고,
 * 그러면 와일드카드 origin 을 쓸 수 없다. 허용 주소를 여기에 명시한다.
 */
@ConfigurationProperties(prefix = "cors")
public record CorsProperties(List<String> allowedOrigins) {
}
