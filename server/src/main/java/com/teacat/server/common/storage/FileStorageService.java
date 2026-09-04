package com.teacat.server.common.storage;

import com.teacat.server.common.exception.BusinessException;
import io.minio.BucketExistsArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.http.Method;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;
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
    public String uploadImage(MultipartFile file, String directory) {
        validateImage(file);

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
     * key 로 유효시간이 걸린 임시 조회 URL 을 발급한다.
     * 버킷을 비공개로 두고도 브라우저가 이미지를 직접 받아갈 수 있게 해준다.
     */
    public String presignedUrl(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }

        try {
            return minioClient.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET)
                    .bucket(properties.bucket())
                    .object(key)
                    .expiry((int) properties.presignedUrlValidity().toSeconds(), TimeUnit.SECONDS)
                    .build());
        } catch (Exception e) {
            log.error("presigned URL 발급 실패. key={}", key, e);
            throw new BusinessException(StorageErrorCode.URL_ISSUE_FAILED);
        }
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

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(StorageErrorCode.EMPTY_FILE);
        }

        if (!ALLOWED_IMAGE_TYPES.containsKey(file.getContentType())) {
            throw new BusinessException(StorageErrorCode.UNSUPPORTED_IMAGE_TYPE);
        }

        if (file.getSize() > properties.maxFileSize().toBytes()) {
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
