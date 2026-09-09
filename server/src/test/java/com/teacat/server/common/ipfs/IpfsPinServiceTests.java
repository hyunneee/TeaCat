package com.teacat.server.common.ipfs;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.StorageErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 네트워크에 닿기 <b>전에</b> 끝나는 부분만 본다 — 입력 검사, 주소 조립, 응답 파싱.
 * 실제 핀은 Pinata 계정이 필요해 여기서 다루지 않는다.
 */
class IpfsPinServiceTests {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static IpfsPinService service(String jwt) {
        return new IpfsPinService(new PinataProperties(
                jwt,
                "https://uploads.pinata.cloud/v3/files",
                "public",
                "https://gateway.pinata.cloud",
                Duration.ofSeconds(3),
                Duration.ofSeconds(30),
                DataSize.ofMegabytes(5)), MAPPER);
    }

    private static JsonNode json(String raw) {
        try {
            return MAPPER.readTree(raw);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void v3_응답에서_CID_를_읽는다() {
        assertThat(IpfsPinService.extractCid(json("""
                {"data": {"id": "1", "cid": "bafyV3", "name": "image.png"}}
                """))).isEqualTo("bafyV3");
    }

    @Test
    void 레거시_응답에서도_CID_를_읽는다() {
        // 주소만 바꿔 레거시 pinning API 로 갈아탈 수 있어야 한다
        assertThat(IpfsPinService.extractCid(json("""
                {"IpfsHash": "bafyLegacy", "PinSize": 100, "Timestamp": "2026-09-08T00:00:00Z"}
                """))).isEqualTo("bafyLegacy");
    }

    @Test
    void CID_가_없는_응답은_null_이다() {
        assertThat(IpfsPinService.extractCid(json("{\"data\": {}}"))).isNull();
        assertThat(IpfsPinService.extractCid(null)).isNull();
    }

    @Test
    void 한도를_넘는_이미지는_Pinata_에_닿기_전에_거절한다() {
        byte[] sixMb = new byte[(int) DataSize.ofMegabytes(6).toBytes()];
        MockMultipartFile file = new MockMultipartFile("image", "card.png", "image/png", sixMb);

        assertThatThrownBy(() -> service("jwt").pinImage(file))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(StorageErrorCode.FILE_TOO_LARGE);
    }

    @Test
    void 이미지가_아닌_파일은_거절한다() {
        MockMultipartFile file = new MockMultipartFile("image", "card.pdf", "application/pdf", new byte[]{1});

        assertThatThrownBy(() -> service("jwt").pinImage(file))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(StorageErrorCode.UNSUPPORTED_IMAGE_TYPE);
    }

    @Test
    void JWT_가_없으면_핀을_시도하지_않는다() {
        MockMultipartFile file = new MockMultipartFile("image", "card.png", "image/png", new byte[]{1, 2, 3});

        assertThatThrownBy(() -> service("").pinImage(file))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(IpfsErrorCode.IPFS_NOT_CONFIGURED);
    }

    @Test
    void 게이트웨이_주소는_슬래시가_겹치지_않는다() {
        IpfsPinService trailing = new IpfsPinService(new PinataProperties(
                "jwt", "https://uploads.pinata.cloud/v3/files", "public",
                "https://gateway.pinata.cloud/",
                Duration.ofSeconds(3), Duration.ofSeconds(30), DataSize.ofMegabytes(5)), MAPPER);

        assertThat(trailing.gatewayUrl("bafy")).isEqualTo("https://gateway.pinata.cloud/ipfs/bafy");
        assertThat(service("jwt").gatewayUrl("bafy")).isEqualTo("https://gateway.pinata.cloud/ipfs/bafy");
        assertThat(service("jwt").gatewayUrl(null)).isNull();
    }
}
