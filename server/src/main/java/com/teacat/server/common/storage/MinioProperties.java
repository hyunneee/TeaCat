package com.teacat.server.common.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

import java.time.Duration;

/**
 * application.yaml 의 minio.* 설정.
 *
 * endpoint 는 S3 API 포트(9000)를 가리켜야 한다.
 * 브라우저로 접속하는 관리 콘솔(9001)을 적으면 연결에 실패한다.
 *
 * 파일 용량 한도는 여기 없다. 용도(포스터·상세 이미지)마다 달라서
 * 각 도메인 설정이 들고 있고, 업로드할 때 인자로 넘긴다.
 *
 * @param endpoint      서버가 MinIO 에 붙는 주소. 배포에서는 컨테이너 내부 주소(http://minio:9000)다
 * @param publicBaseUrl 브라우저가 MinIO 에 닿는 주소. presigned URL 의 endpoint 부분을 이 값으로 바꿔 내려준다.
 *                      비어 있으면 바꾸지 않는다(로컬처럼 endpoint 가 브라우저에서도 열리는 경우).
 *                      배포에서는 nginx 가 이 경로를 MinIO 로 넘긴다 — 서명은 endpoint 의 Host 로 계산되므로
 *                      nginx 가 Host 헤더를 endpoint 의 것으로 되돌려 보내야 한다.
 */
@ConfigurationProperties(prefix = "minio")
public record MinioProperties(
        String endpoint,
        String accessKey,
        String secretKey,
        String bucket,
        Duration presignedUrlValidity,
        String publicBaseUrl
) {

    public boolean hasPublicBaseUrl() {
        return StringUtils.hasText(publicBaseUrl);
    }
}
