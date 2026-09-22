package com.teacat.server.common.storage;

import com.teacat.server.common.exception.BusinessException;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
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

import java.io.ByteArrayInputStream;
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
        ImageFiles.validate(file, maxSize);

        String key = generateKey(directory, ImageFiles.extensionOf(file.getContentType()));

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
     * 공개로 읽히는 이미지를 올리고 <b>만료 없는 고정 조회 주소</b>를 돌려준다.
     *
     * <p><b>포토카드 도안 그림 전용이다.</b> 포스터·티켓·좌석배치도는 그대로 presigned 를 쓴다.
     * 이쪽만 고정 주소인 이유는 두 가지다.
     * <ol>
     *   <li>도안 그림은 이미 IPFS 로 전세계 공개된 자산이라 서명이 지킬 것이 없다</li>
     *   <li>presigned 는 유효시간마다 서명이 달라져 <b>같은 그림이 매번 새 URL</b> 이 된다.
     *       그러면 브라우저 캐시도, 프론트 서비스워커의 image-cache(maxEntries 200)도
     *       통째로 무력화되고 포스터 캐시까지 밀려난다</li>
     * </ol>
     *
     * <p>만료가 없으므로 <b>이 주소는 DB 에 저장해도 된다</b> — 클래스 주석의 "presigned URL 은
     * DB 에 저장하면 안 된다" 는 presigned 에만 해당한다.
     *
     * <p>🔴 이 주소가 열리려면 버킷의 해당 접두사에 익명 읽기 정책이 걸려 있어야 한다:
     * {@code mc anonymous set download <별칭>/<버킷>/public/photocards}.
     * 정책이 없으면 <b>업로드는 되고 조회만 403</b> 이 나므로 배포 환경마다 확인해야 한다.
     *
     * @param key 저장 key. 도안 그림은 CID 를 쓴다 — 내용 주소라 같은 그림이면 키도 같아
     *            중복이 자동으로 정리되고, 어느 원본인지 추적된다
     */
    public String uploadPublic(byte[] bytes, String key, String contentType) {
        try (InputStream stream = new ByteArrayInputStream(bytes)) {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(properties.bucket())
                    .object(key)
                    .stream(stream, bytes.length, -1)
                    .contentType(contentType)
                    // 키가 CID 라 바이트가 바뀌면 키도 바뀐다. 길게 잡아도 낡은 그림이 남지 않는다.
                    // (다만 현재 nginx 가 /storage/ 응답에 max-age=600 을 덮어쓰고 있다)
                    .headers(Map.of("Cache-Control", "public, max-age=31536000, immutable"))
                    .build());
        } catch (Exception e) {
            log.error("MinIO 공개 업로드 실패. key={}", key, e);
            throw new BusinessException(StorageErrorCode.UPLOAD_FAILED);
        }

        return publicObjectUrl(key);
    }

    /** 공개 객체의 고정 조회 주소. presigned 와 달리 만료되지 않는다. */
    public String publicObjectUrl(String key) {
        String base = properties.hasPublicBaseUrl()
                ? stripTrailingSlash(properties.publicBaseUrl())
                : stripTrailingSlash(properties.endpoint());
        return base + "/" + properties.bucket() + "/" + key;
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
        String extension = ImageFiles.extensionOf(contentType);

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

    /**
     * 이미 바이트로 들고 있는 이미지를 올리고 저장 key 를 돌려준다.
     *
     * <p>{@link #uploadImage} 와 달리 {@link MultipartFile} 이 아니다. base64 로 받아
     * 디코드해 둔 이미지처럼 <b>업로드 요청의 일부로 오지 않은</b> 바이트를 위한 것이다.
     * 크기·형식 검사는 이미 끝났다고 보고 여기서 다시 하지 않는다.
     *
     * @param directory   용도별 상위 경로. 예: "sticker/sketch"
     * @param contentType MIME 타입. 확장자는 여기서 정해진다
     */
    public String uploadBytes(byte[] bytes, String directory, String contentType) {
        String extension = ImageFiles.extensionOf(contentType);

        if (extension == null) {
            throw new BusinessException(StorageErrorCode.UNSUPPORTED_IMAGE_TYPE);
        }

        String key = generateKey(directory, extension);

        try (InputStream stream = new ByteArrayInputStream(bytes)) {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(properties.bucket())
                    .object(key)
                    .stream(stream, bytes.length, -1)
                    .contentType(contentType)
                    .build());
        } catch (Exception e) {
            log.error("MinIO 업로드 실패. key={}", key, e);
            throw new BusinessException(StorageErrorCode.UPLOAD_FAILED);
        }

        return key;
    }

    /**
     * key 에 저장된 파일을 바이트로 읽는다.
     *
     * <p>브라우저에는 {@link #presignedUrl} 로 주소만 주면 되지만, <b>서버가 내용을 직접
     * 써야 하는 경우</b>가 있다 — 낙서를 base64 로 워커에 실어 보낼 때처럼.
     * 파일 전체가 힙에 올라오므로 큰 파일에는 쓰지 말 것.
     */
    public byte[] download(String key) {
        try (InputStream stream = minioClient.getObject(GetObjectArgs.builder()
                .bucket(properties.bucket())
                .object(key)
                .build())) {
            return stream.readAllBytes();
        } catch (Exception e) {
            log.error("MinIO 읽기 실패. key={}", key, e);
            throw new BusinessException(StorageErrorCode.DOWNLOAD_FAILED);
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
