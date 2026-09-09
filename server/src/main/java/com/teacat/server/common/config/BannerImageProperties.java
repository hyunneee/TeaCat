package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

/**
 * application.yaml 의 banner.image.* 설정.
 *
 * 메인 배너는 가로로 넓은 한 장짜리라 포스터보다 넉넉히 잡는다.
 * 한도는 업로드 URL 을 내줄 때와 key 를 넘겨받을 때 똑같이 적용된다 — 한쪽에만 걸면 없는 것과 같다.
 */
@ConfigurationProperties(prefix = "banner.image")
public record BannerImageProperties(DataSize maxSize) {
}
