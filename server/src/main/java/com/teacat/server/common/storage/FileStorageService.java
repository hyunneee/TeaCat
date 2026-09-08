package com.teacat.server.common.storage;

import com.teacat.server.common.exception.BusinessException;
import io.minio.BucketExistsArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import io.minio.errors.ErrorResponseException;
import io.minio.http.Method;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.OptionalLong;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * MinIO 에 파일을 올리고 내리는 공용 서비스.
 *
 * 각 도메인 서비스는 upload() 가 돌려준 key 를 DB 에 저장하고,
 * 응답을 만들 때 presignedUrl(key) 로 임시 조회 주소를 발급해 내려준다.
 * presigned URL 은 만료되므로 DB 에 저장하면 안 된다.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class FileStorageService {

    /** 허용 이미지 타입과 저장할 때 붙일 확장자 */
    private static final Map<String, String> ALLOWED_IMAGE_TYPES = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp",
            "image/gif", ".gif"
    );

    private static final DateTimeFormatter KEY_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy/MM");

    private final MinioClient minioClient;
    private final MinioProperties properties;

    /**
     * 버킷이 없으면 만들어 둔다.
     * 팀원마다 콘솔에서 수동으로 버킷을 만들지 않아도 되게 하기 위함이다.
     */
    @PostConstruct
    void ensureBucketExists() {
        try {
            boolean exists = minioClient.bucketExists(
                    BucketExistsArgs.builder().bucket(properties.bucket()).build());

            if (!exists) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(properties.bucket()).build());
                log.info("MinIO 버킷을 생성했습니다: {}", properties.bucket());
            }
        } catch (Exception e) {
            throw new IllegalStateException(
                    "MinIO 에 연결하지 못했습니다. 컨테이너가 떠 있는지 확인하세요: " + properties.endpoint(), e);
        }
    }

    /**
     * 이미지를 업로드하고 저장 key 를 돌려준다.
     *
     * @param file      업로드할 이미지
     * @param directory 용도별 상위 경로. 예: "performance/poster"
     * @return DB 에 저장할 key. 예: "performance/poster/2026/09/a1b2....png"
     */
    public String uploadImage(MultipartFile file, String directory, DataSize maxSize) {
        validateImage(file, maxSize);

        String key = generateKey(directory, ALLOWED_IMAGE_TYPES.get(file.getContentType()));

        try (InputStream stream = file.getInputStream()) {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(properties.bucket())
                    .object(key)
                    .stream(stream, file.getSize(), -1)
                    .contentType(file.getContentType())
                    .build());
        } catch (Exception e) {
            log.error("MinIO 업로드 실패. key={}", key, e);
            throw new BusinessException(StorageErrorCode.UPLOAD_FAILED);
        }

        return key;
    }

    /**
     * 클라이언트가 파일을 직접 올릴 수 있는 임시 업로드 URL 을 발급한다 (API-270).
     *
     * 파일 바이트가 서버를 거치지 않아 서버 메모리·대역폭을 쓰지 않는다.
     * 클라이언트는 이 URL 로 PUT 한 뒤, 돌려받은 key 를 등록·수정 API 에 넘긴다.
     *
     * @param directory   용도별 상위 경로
     * @param contentType 올릴 파일의 MIME 타입. 허용 목록에 없으면 거절한다
     */
    public PresignedUpload presignedUploadUrl(String directory, String contentType) {
        String extension = ALLOWED_IMAGE_TYPES.get(contentType);

        if (extension == null) {
            throw new BusinessException(StorageErrorCode.UNSUPPORTED_IMAGE_TYPE);
        }

        String key = generateKey(directory, extension);
        Duration validity = properties.presignedUrlValidity();

        try {
            String url = minioClient.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .method(Method.PUT)
                    .bucket(properties.bucket())
                    .object(key)
                    .expiry((int) validity.toSeconds(), TimeUnit.SECONDS)
                    .build());

            return new PresignedUpload(key, toPublicUrl(url), validity.toSeconds());
        } catch (Exception e) {
            log.error("업로드 URL 발급 실패. key={}", key, e);
            throw new BusinessException(StorageErrorCode.URL_ISSUE_FAILED);
        }
    }

    /**
     * key 에 해당하는 객체의 크기(바이트). 객체가 없으면 비어 있다.
     *
     * 업로드 URL 로 올린 파일은 서버를 거치지 않아 올릴 때 용량을 볼 수 없다.
     * 그래서 key 를 등록하는 시점에 실제 크기를 확인해 한도를 넘었는지 판단한다.
     * 파일을 올리지 않은 채 key 만 등록하는 것도 같은 호출로 걸러진다.
     */
    public OptionalLong objectSize(String key) {
        try {
            StatObjectResponse stat = minioClient.statObject(StatObjectArgs.builder()
                    .bucket(properties.bucket())
                    .object(key)
                    .build());
            return OptionalLong.of(stat.size());
        } catch (ErrorResponseException e) {
            return OptionalLong.empty();
        } catch (Exception e) {
            log.error("객체 확인 실패. key={}", key, e);
            throw new BusinessException(StorageErrorCode.URL_ISSUE_FAILED);
        }
    }

    /** 발급된 업로드 URL 과 그때 정해진 저장 key */
    public record PresignedUpload(String key, String uploadUrl, long expiresInSeconds) {
    }

    /**
     * key 로 유효시간이 걸린 임시 조회 URL 을 발급한다.
     * 버킷을 비공개로 두고도 브라우저가 이미지를 직접 받아갈 수 있게 해준다.
     */
    public String presignedUrl(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }

        try {
            return toPublicUrl(minioClient.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET)
                    .bucket(properties.bucket())
                    .object(key)
                    .expiry((int) properties.presignedUrlValidity().toSeconds(), TimeUnit.SECONDS)
                    .build()));
        } catch (Exception e) {
            log.error("presigned URL 발급 실패. key={}", key, e);
            throw new BusinessException(StorageErrorCode.URL_ISSUE_FAILED);
        }
    }

    /**
     * presigned URL 의 앞부분(서버가 MinIO 에 붙는 주소)을 브라우저가 열 수 있는 주소로 바꾼다.
     *
     * 배포에서는 endpoint 가 컨테이너 내부 주소(http://minio:9000)라 그대로 내려주면 이미지가 깨진다.
     * 서명(SigV4)은 Host 와 경로로 계산되므로 뒷단(nginx)이 Host 헤더를 endpoint 의 것으로 되돌려 넘기면
     * 주소만 바꿔도 서명이 그대로 맞는다. 조회(GET)와 업로드(PUT) URL 모두 같은 규칙이다.
     */
    String toPublicUrl(String url) {
        if (!properties.hasPublicBaseUrl() || url == null) {
            return url;
        }

        String internal = stripTrailingSlash(properties.endpoint());
        if (!url.startsWith(internal)) {
            return url;
        }

        return stripTrailingSlash(properties.publicBaseUrl()) + url.substring(internal.length());
    }

    private static String stripTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    /** 게시물 삭제나 이미지 교체로 더 이상 쓰지 않는 파일을 지운다. */
    public void delete(String key) {
        if (key == null || key.isBlank()) {
            return;
        }

        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(properties.bucket())
                    .object(key)
                    .build());
        } catch (Exception e) {
            log.error("MinIO 삭제 실패. key={}", key, e);
            throw new BusinessException(StorageErrorCode.DELETE_FAILED);
        }
    }

    private void validateImage(MultipartFile file, DataSize maxSize) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(StorageErrorCode.EMPTY_FILE);
        }

        if (!ALLOWED_IMAGE_TYPES.containsKey(file.getContentType())) {
            throw new BusinessException(StorageErrorCode.UNSUPPORTED_IMAGE_TYPE);
        }

        if (file.getSize() > maxSize.toBytes()) {
            throw new BusinessException(StorageErrorCode.FILE_TOO_LARGE);
        }
    }

    /**
     * 저장 key 를 만든다. 원본 파일명은 쓰지 않는다.
     * 한글/공백/중복 파일명 문제를 피하고, 파일명으로 남의 파일을 추측하지 못하게 하기 위함이다.
     */
    private String generateKey(String directory, String extension) {
        return "%s/%s/%s%s".formatted(
                directory,
                LocalDate.now().format(KEY_DATE_FORMAT),
                UUID.randomUUID(),
                extension);
    }
}
