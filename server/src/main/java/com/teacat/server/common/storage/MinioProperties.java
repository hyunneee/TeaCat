package com.teacat.server.common.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * application.yaml 의 minio.* 설정.
 *
 * endpoint 는 S3 API 포트(9000)를 가리켜야 한다.
 * 브라우저로 접속하는 관리 콘솔(9001)을 적으면 연결에 실패한다.
 *
 * 파일 용량 한도는 여기 없다. 용도(포스터·상세 이미지)마다 달라서
 * 각 도메인 설정이 들고 있고, 업로드할 때 인자로 넘긴다.
 */
@ConfigurationProperties(prefix = "minio")
public record MinioProperties(
        String endpoint,
        String accessKey,
        String secretKey,
        String bucket,
        Duration presignedUrlValidity
) {
}
