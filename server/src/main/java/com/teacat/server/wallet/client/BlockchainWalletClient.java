package com.teacat.server.wallet.client;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.wallet.exception.WalletErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigInteger;
import java.util.Map;

/**
 * 블록체인 서비스(Node.js)의 내부 API 호출.
 *
 * 이 서비스는 마스터 니모닉과 오퍼레이터 키를 쥐고 있어 루프백에만 열려 있고,
 * 모든 요청에 x-internal-key 헤더가 필요하다. (blockchain/DESIGN.md 1장)
 *
 * 같은 파생 인덱스로 몇 번을 불러도 같은 주소가 나오고 시드도 한 번만 나가므로
 * 재시도해도 안전하다.
 */
@Slf4j
@Component
public class BlockchainWalletClient {

    private static final String INTERNAL_KEY_HEADER = "x-internal-key";
    private static final String CREATE_WALLET_PATH = "/internal/wallets";

    private final BlockchainProperties properties;
    private final RestClient restClient;

    public BlockchainWalletClient(BlockchainProperties properties) {
        this.properties = properties;
        this.restClient = RestClient.builder()
                .baseUrl(properties.baseUrl())
                .requestFactory(requestFactory(properties))
                .build();
    }

    private static ClientHttpRequestFactory requestFactory(BlockchainProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) properties.connectTimeout().toMillis());
        // 체인에 트랜잭션을 보내고 오므로 일반 API 보다 넉넉히 잡는다
        factory.setReadTimeout((int) properties.readTimeout().toMillis());
        return factory;
    }

    /**
     * 파생 인덱스로 지갑 주소를 만들고 시드 캣머니를 발행한다.
     *
     * @param seedAmount 발행할 캣머니. null 이면 주소만 계산한다
     */
    public WalletCreationResponse createWallet(int derivationIndex, BigInteger seedAmount) {
        if (!properties.isConfigured()) {
            log.error("블록체인 서비스 설정이 비어 있습니다 (blockchain.base-url / blockchain.internal-api-key)");
            throw new BusinessException(WalletErrorCode.BLOCKCHAIN_NOT_CONFIGURED);
        }

        Map<String, Object> body = seedAmount == null
                ? Map.of("derivationIndex", derivationIndex)
                : Map.of("derivationIndex", derivationIndex, "seedAmount", seedAmount.toString());

        try {
            WalletCreationResponse response = restClient.post()
                    .uri(CREATE_WALLET_PATH)
                    .header(INTERNAL_KEY_HEADER, properties.internalApiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(WalletCreationResponse.class);

            if (response == null || response.address() == null) {
                log.error("지갑 생성 응답이 비어 있습니다. derivationIndex={}", derivationIndex);
                throw new BusinessException(WalletErrorCode.WALLET_CREATION_FAILED);
            }

            return response;
        } catch (RestClientResponseException e) {
            // 블록체인 서비스는 { code, message } 로 이유를 알려준다 (CHAIN_UNAVAILABLE 등)
            log.error("지갑 생성 실패 derivationIndex={} status={} body={}",
                    derivationIndex, e.getStatusCode(), e.getResponseBodyAsString());
            throw new BusinessException(WalletErrorCode.WALLET_CREATION_FAILED);
        } catch (BusinessException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("지갑 생성 요청이 실패했습니다. derivationIndex={}", derivationIndex, e);
            throw new BusinessException(WalletErrorCode.WALLET_CREATION_FAILED);
        }
    }
}
