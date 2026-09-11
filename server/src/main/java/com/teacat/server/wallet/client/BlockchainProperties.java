package com.teacat.server.wallet.client;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * application.yaml 의 blockchain.* 설정.
 *
 * internal-api-key 는 blockchain/.env 의 INTERNAL_API_KEY 와 같은 값이어야 한다.
 * 설정 파일에 적지 않고 환경변수(BLOCKCHAIN_INTERNAL_API_KEY)로만 주입한다.
 *
 * @param chainId wallets.chain_id 에 저장할 값. blockchain/.env 의 CHAIN_ID 와 반드시 같아야 한다
 */
@ConfigurationProperties(prefix = "blockchain")
public record BlockchainProperties(
        String baseUrl,
        String internalApiKey,
        int chainId,
        Duration connectTimeout,
        Duration readTimeout
) {

    public boolean isConfigured() {
        return baseUrl != null && !baseUrl.isBlank()
                && internalApiKey != null && !internalApiKey.isBlank();
    }
}
