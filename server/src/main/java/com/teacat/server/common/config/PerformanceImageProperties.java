package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

/**
 * application.yaml 의 performance.image.* 설정.
 *
 * 공연 이미지 용량 한도다. 용도마다 다르게 둔다.
 * 포스터는 목록에서 여러 장이 한 화면에 뜨므로 가벼워야 하고,
 * 상세 이미지는 세로로 긴 한 장짜리라 그보다 넉넉해야 한다.
 *
 * 한도는 파일을 서버로 직접 올릴 때(API-261)와
 * 업로드 URL 로 MinIO 에 바로 올린 뒤 key 를 넘길 때(API-262) 똑같이 적용된다.
 * 한쪽에만 걸면 없는 것과 같다.
 */
@ConfigurationProperties(prefix = "performance.image")
public record PerformanceImageProperties(

        /** 포스터 이미지 최대 용량 */
        DataSize posterMaxSize,

        /** 상세 페이지 이미지 최대 용량 */
        DataSize detailMaxSize
) {
}
