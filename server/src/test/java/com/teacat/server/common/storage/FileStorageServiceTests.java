package com.teacat.server.common.storage;

import com.teacat.server.common.exception.BusinessException;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * 직접 업로드(multipart) 경로의 용량 검사와 presigned URL 의 공개 주소 치환.
 */
@ExtendWith(MockitoExtension.class)
class FileStorageServiceTests {

    private static final String INTERNAL = "http://minio:9000";

    @Mock
    private MinioClient minioClient;

    private FileStorageService service(String publicBaseUrl) {
        return new FileStorageService(minioClient,
                new MinioProperties(INTERNAL, "a", "b", "teacat", Duration.ofMinutes(10), publicBaseUrl));
    }

    @Test
    void 호출자가_준_한도를_넘는_파일은_MinIO_에_닿기_전에_거절한다() {
        byte[] sixMb = new byte[(int) DataSize.ofMegabytes(6).toBytes()];
        MockMultipartFile file = new MockMultipartFile("poster", "p.png", "image/png", sixMb);

        assertThatThrownBy(() -> service(null).uploadImage(file, "performance/poster", DataSize.ofMegabytes(5)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(StorageErrorCode.FILE_TOO_LARGE);

        verifyNoInteractions(minioClient);
    }

    @Test
    void 허용되지_않는_형식은_거절한다() {
        MockMultipartFile file = new MockMultipartFile("poster", "p.svg", "image/svg+xml", new byte[10]);

        assertThatThrownBy(() -> service(null).uploadImage(file, "performance/poster", DataSize.ofMegabytes(5)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(StorageErrorCode.UNSUPPORTED_IMAGE_TYPE);
    }

    @Test
    void 공개_주소가_설정되면_presigned_URL_의_내부_주소만_바꾸고_경로와_서명은_그대로_둔다() throws Exception {
        given(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .willReturn(INTERNAL + "/teacat/performance/poster/a.png?X-Amz-Signature=abc");

        String url = service("https://dev.teacat.site/storage/").presignedUrl("performance/poster/a.png");

        assertThat(url).isEqualTo("https://dev.teacat.site/storage/teacat/performance/poster/a.png?X-Amz-Signature=abc");
    }

    @Test
    void 공개_주소가_없으면_presigned_URL_을_그대로_준다() throws Exception {
        given(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .willReturn(INTERNAL + "/teacat/k.png?X-Amz-Signature=abc");

        assertThat(service(null).presignedUrl("k.png")).isEqualTo(INTERNAL + "/teacat/k.png?X-Amz-Signature=abc");
        assertThat(service("").presignedUrl("k.png")).isEqualTo(INTERNAL + "/teacat/k.png?X-Amz-Signature=abc");
    }
}
