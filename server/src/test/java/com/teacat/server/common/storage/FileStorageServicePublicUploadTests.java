package com.teacat.server.common.storage;

import io.minio.BucketExistsArgs;
import io.minio.MinioClient;
import io.minio.RemoveObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.util.unit.DataSize;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * {@link FileStorageService#uploadPublic} 을 <b>진짜 MinIO</b> 에 대고 돌린다.
 *
 * <p>나머지 저장소 테스트({@link FileStorageServiceTests})는 {@code MinioClient} 를 모킹한다.
 * 그러면 인자를 올바로 조립했는지는 보지만 <b>MinIO 가 그 인자를 받아주는지는 못 본다</b> —
 * 특히 {@code .headers(...)} 로 Cache-Control 을 붙이는 부분과 {@code stream(size, -1)} 은
 * 모킹으로는 통과하고 실제 호출에서만 터질 수 있다. 포토카드 도안 그림이 이 경로로 올라가므로
 * 한 번은 실물로 확인한다.
 *
 * <p>MinIO 가 없으면 <b>건너뛴다</b>(실패가 아니다). 로컬은
 * {@code docker compose -f docker/docker-compose.yml up -d} 로 띄운다.
 *
 * <p>🔴 이 테스트는 업로드까지만 본다. 브라우저가 그 주소를 열 수 있는지는 <b>버킷의 익명 읽기
 * 정책</b>에 달려 있고 그건 코드 밖이다 ({@code mc anonymous set download <별칭>/<버킷>/public/photocards}).
 * 정책이 없으면 업로드는 되고 조회만 403 이 난다.
 */
class FileStorageServicePublicUploadTests {

    private static final String ENDPOINT = "http://localhost:9000";
    private static final String BUCKET = "teacat";
    private static final String KEY = "public/photocards/__uploadPublic-test.png";

    /** 1x1 투명 PNG */
    private static final byte[] PNG = {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, (byte) 0xC4,
            (byte) 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
            0x54, 0x78, (byte) 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, (byte) 0xB4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, (byte) 0xAE,
            0x42, 0x60, (byte) 0x82
    };

    private MinioClient client;
    private FileStorageService service;

    @BeforeEach
    void setUp() {
        client = MinioClient.builder()
                .endpoint(ENDPOINT)
                .credentials("admin", "password123")
                .build();

        boolean reachable;
        try {
            client.bucketExists(BucketExistsArgs.builder().bucket(BUCKET).build());
            reachable = true;
        } catch (Exception e) {
            reachable = false;
        }
        assumeTrue(reachable, "MinIO 가 " + ENDPOINT + " 에 없어 건너뜁니다");

        service = new FileStorageService(client,
                new MinioProperties(ENDPOINT, "admin", "password123", BUCKET,
                        Duration.ofMinutes(10), "https://teacat.site/storage"));
        service.ensureBucketExists();
    }

    @AfterEach
    void tearDown() {
        if (client == null) {
            return;
        }
        try {
            client.removeObject(RemoveObjectArgs.builder().bucket(BUCKET).object(KEY).build());
        } catch (Exception ignored) {
            // 테스트가 남긴 객체를 못 지워도 본 검증에는 영향이 없다
        }
    }

    @Test
    void 공개_업로드가_실제로_올라가고_고정_주소를_돌려준다() throws Exception {
        String url = service.uploadPublic(PNG, KEY, "image/png");

        // presigned 와 달리 서명 쿼리가 없어야 한다 — 그래야 DB 에 저장해도 되고 캐시도 먹는다
        assertThat(url).isEqualTo("https://teacat.site/storage/teacat/" + KEY);
        assertThat(url).doesNotContain("X-Amz-Signature");

        StatObjectResponse stat = client.statObject(
                StatObjectArgs.builder().bucket(BUCKET).object(KEY).build());

        assertThat(stat.size()).isEqualTo(PNG.length);
        assertThat(stat.contentType()).isEqualTo("image/png");
        // 키가 CID 라 바이트가 바뀌면 키도 바뀐다 — 길게 잡아도 낡은 그림이 남지 않는다
        assertThat(stat.headers().get("Cache-Control")).contains("immutable");
    }

    @Test
    void 같은_키로_다시_올리면_덮어쓴다() throws Exception {
        service.uploadPublic(PNG, KEY, "image/png");
        String url = service.uploadPublic(PNG, KEY, "image/png");

        // 키가 CID 라 같은 그림을 여러 템플릿이 쓰면 이 경로로 온다. 중복 객체가 생기면 안 된다.
        assertThat(url).isEqualTo("https://teacat.site/storage/teacat/" + KEY);
        assertThat(client.statObject(StatObjectArgs.builder().bucket(BUCKET).object(KEY).build())
                .size()).isEqualTo(PNG.length);
    }

    @Test
    void 공개_주소가_없으면_내부_엔드포인트로_만든다() {
        FileStorageService noPublic = new FileStorageService(client,
                new MinioProperties(ENDPOINT, "admin", "password123", BUCKET,
                        Duration.ofMinutes(10), null));

        // 로컬은 MINIO_PUBLIC_BASE_URL 이 비어 있고 localhost:9000 이 브라우저에서도 열린다
        assertThat(noPublic.publicObjectUrl("public/photocards/a.webp"))
                .isEqualTo(ENDPOINT + "/teacat/public/photocards/a.webp");
    }

    @Test
    void 허용_한도_안의_이미지는_그대로_올라간다() throws Exception {
        // 도안 이미지 한도는 5MB 다. 그 근처 크기가 stream(size, -1) 로 통과하는지 본다.
        byte[] big = new byte[(int) DataSize.ofMegabytes(4).toBytes()];
        System.arraycopy(PNG, 0, big, 0, PNG.length);

        service.uploadPublic(big, KEY, "image/png");

        assertThat(client.statObject(StatObjectArgs.builder().bucket(BUCKET).object(KEY).build())
                .size()).isEqualTo(big.length);
    }
}
