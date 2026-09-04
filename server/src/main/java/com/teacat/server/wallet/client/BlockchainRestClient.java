package com.teacat.server.wallet.client;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.exception.ErrorCode;
import com.teacat.server.wallet.exception.WalletErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.Map;

/**
 * 블록체인 서비스(Node.js)와의 HTTP 통신만 담당한다.
 *
 * 이 서비스는 마스터 니모닉과 오퍼레이터 키를 쥐고 있어 루프백에만 열려 있고,
 * 모든 /internal 요청에 x-internal-key 헤더가 필요하다. (blockchain/DESIGN.md 1장)
 *
 * <p>여기는 <b>어떤 엔드포인트인지 모릅니다.</b> 주소·인증·타임아웃·실패 변환만 압니다.
 * 무엇을 부르고 실패를 어떤 의미로 볼지는 각 도메인 클라이언트가 정합니다
 * ({@link BlockchainWalletClient}, {@link CatMoneyClient}).
 */
@Slf4j
@Component
public class BlockchainRestClient {

    private static final String INTERNAL_KEY_HEADER = "x-internal-key";

    private final BlockchainProperties properties;
    private final RestClient restClient;

    public BlockchainRestClient(BlockchainProperties properties) {
        this.properties = properties;
        this.restClient = RestClient.builder()
                .baseUrl(properties.baseUrl())
                .requestFactory(requestFactory(properties))
                .build();
    }

    private static ClientHttpRequestFactory requestFactory(BlockchainProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) properties.connectTimeout().toMillis());
        // 체인에 다녀오므로 일반 API 보다 넉넉히 잡는다
        factory.setReadTimeout((int) properties.readTimeout().toMillis());
        return factory;
    }

    /**
     * @param onFailure 실패를 어떤 의미로 볼지는 부르는 쪽이 정한다
     *                  (지갑 생성 실패와 잔액 조회 실패는 사용자에게 다른 말이어야 한다)
     */
    public <T> T get(String path, Map<String, String> queryParams, Class<T> responseType, ErrorCode onFailure) {
        requireConfigured();

        return execute(path, onFailure, () -> restClient.get()
                .uri(uriBuilder -> {
                    uriBuilder.path(path);
                    queryParams.forEach(uriBuilder::queryParam);
                    return uriBuilder.build();
                })
                .header(INTERNAL_KEY_HEADER, properties.internalApiKey())
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(responseType));
    }

    public <T> T post(String path, Object body, Class<T> responseType, ErrorCode onFailure) {
        requireConfigured();

        return execute(path, onFailure, () -> restClient.post()
                .uri(path)
                .header(INTERNAL_KEY_HEADER, properties.internalApiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(responseType));
    }

    private <T> T execute(String path, ErrorCode onFailure, java.util.function.Supplier<T> call) {
        try {
            T response = call.get();

            if (response == null) {
                log.error("블록체인 서비스 응답이 비어 있습니다. path={}", path);
                throw new BusinessException(onFailure);
            }

            return response;
        } catch (RestClientResponseException e) {
            // 블록체인 서비스는 { code, message } 로 이유를 알려준다 (CHAIN_UNAVAILABLE 등)
            log.error("블록체인 서비스 호출 실패 path={} status={} body={}",
                    path, e.getStatusCode(), e.getResponseBodyAsString());
            throw new BusinessException(onFailure);
        } catch (BusinessException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("블록체인 서비스 호출이 실패했습니다. path={}", path, e);
            throw new BusinessException(onFailure);
        }
    }

    private void requireConfigured() {
        if (!properties.isConfigured()) {
            log.error("블록체인 서비스 설정이 비어 있습니다 (blockchain.base-url / blockchain.internal-api-key)");
            throw new BusinessException(WalletErrorCode.BLOCKCHAIN_NOT_CONFIGURED);
        }
    }
}
