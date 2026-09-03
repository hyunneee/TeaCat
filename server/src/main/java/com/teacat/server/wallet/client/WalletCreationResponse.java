package com.teacat.server.wallet.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * POST /internal/wallets 응답.
 *
 * @param address 체크섬 대소문자가 섞여 온다. DB 에 넣기 전에 소문자로 바꿔야 한다
 * @param seed    seedAmount 를 보내지 않았으면 null
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record WalletCreationResponse(
        String address,
        Integer derivationIndex,
        String path,
        String type,
        Seed seed
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Seed(
            /** PENDING(방금 보냄) 또는 ALREADY_DONE(이미 발행돼 있었음) */
            String status,
            String amount,
            /** ALREADY_DONE 이면 새 트랜잭션이 없어 null */
            String txHash
    ) {
    }
}
