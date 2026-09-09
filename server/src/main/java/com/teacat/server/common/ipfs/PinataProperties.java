package com.teacat.server.common.ipfs;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;
import org.springframework.util.unit.DataSize;

import java.time.Duration;

/**
 * application.yaml 의 ipfs.pinata.* 설정.
 *
 * <p>jwt 는 이 파일에 적지 말고 환경변수(PINATA_JWT)로만 주입한다. 비어 있으면 도안 생성이
 * IPFS_NOT_CONFIGURED 로 거절되고 나머지 기능은 그대로 동작한다.
 *
 * <p><b>uploadUrl 을 설정으로 뺀 이유.</b> Pinata 는 레거시 pinning API
 * ({@code api.pinata.cloud/pinning/pinFileToIPFS}) 와 v3 Files API
 * ({@code uploads.pinata.cloud/v3/files}) 를 같이 굴리고 있다. 기본값은 v3 이지만
 * 계정·요금제에 따라 다른 쪽을 써야 할 수 있어 <b>코드를 고치지 않고 주소만 바꿀 수 있게</b> 열어뒀다.
 * 응답에서 CID 를 꺼내는 쪽도 두 모양을 모두 읽는다 ({@link IpfsPinService}).
 *
 * @param network      v3 Files API 의 필수 필드. public 이어야 게이트웨이로 열린다.
 *                     레거시 주소를 쓰면 이 값을 비워서 필드를 아예 안 보낼 수 있다
 * @param gatewayUrl   브라우저가 여는 주소를 만들 때 쓴다. {@code ipfs://} 는 브라우저가 못 연다.
 *                     체인에 올라가는 값은 어디까지나 {@code ipfs://<cid>} 이고 이건 표시용이다
 * @param imageMaxSize 도안 이미지 용량 한도. 지갑과 목록에서 함께 뜨므로 공연 포스터급으로 잡는다
 */
@ConfigurationProperties(prefix = "ipfs.pinata")
public record PinataProperties(
        String jwt,
        String uploadUrl,
        String network,
        String gatewayUrl,
        Duration connectTimeout,
        Duration readTimeout,
        DataSize imageMaxSize
) {

    public boolean isConfigured() {
        return StringUtils.hasText(jwt) && StringUtils.hasText(uploadUrl);
    }

    public boolean hasNetwork() {
        return StringUtils.hasText(network);
    }
}
