package com.teacat.server.common.storage;

import com.teacat.server.common.exception.BusinessException;
import io.minio.MinioClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * 직접 업로드(multipart) 경로의 용량 검사. 한도는 호출하는 쪽이 정한다.
 */
@ExtendWith(MockitoExtension.class)
class FileStorageServiceTests {

    @Mock
    private MinioClient minioClient;

    private FileStorageService service() {
        return new FileStorageService(minioClient,
                new MinioProperties("http://localhost:9000", "a", "b", "teacat", Duration.ofMinutes(10)));
    }

    @Test
    void 호출자가_준_한도를_넘는_파일은_MinIO_에_닿기_전에_거절한다() {
        byte[] sixMb = new byte[(int) DataSize.ofMegabytes(6).toBytes()];
        MockMultipartFile file = new MockMultipartFile("poster", "p.png", "image/png", sixMb);

        assertThatThrownBy(() -> service().uploadImage(file, "performance/poster", DataSize.ofMegabytes(5)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(StorageErrorCode.FILE_TOO_LARGE);

        verifyNoInteractions(minioClient);
    }

    @Test
    void 허용되지_않는_형식은_거절한다() {
        MockMultipartFile file = new MockMultipartFile("poster", "p.svg", "image/svg+xml", new byte[10]);

        assertThatThrownBy(() -> service().uploadImage(file, "performance/poster", DataSize.ofMegabytes(5)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(StorageErrorCode.UNSUPPORTED_IMAGE_TYPE);
    }
}
