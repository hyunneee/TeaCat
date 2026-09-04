package com.teacat.server.wallet.client;

import com.teacat.server.wallet.exception.WalletErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 캣머니 토큰 조회 (GET /internal/tokens/catmoney/balance).
 *
 * 잔액은 <b>저장하지 않는다.</b> 체인이 진실이고, 캐시하면 반드시 어긋난다.
 * (blockchain/DESIGN.md 5-3 "저장하지 않는 것")
 *
 * 발행·소각(mint/burn)이 필요해지면 여기에 메서드를 추가한다.
 */
@Component
@RequiredArgsConstructor
public class CatMoneyClient {

    private static final String BALANCE_PATH = "/internal/tokens/catmoney/balance";
    private static final String ADDRESS_PARAM = "address";

    private final BlockchainRestClient blockchainRestClient;

    public CatMoneyBalanceResult getBalance(String address) {
        return blockchainRestClient.get(
                BALANCE_PATH,
                Map.of(ADDRESS_PARAM, address),
                CatMoneyBalanceResult.class,
                WalletErrorCode.BALANCE_UNAVAILABLE);
    }
}
