package com.teacat.server.wallet.client;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.wallet.exception.WalletErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigInteger;
import java.util.Map;

/**
 * 지갑 발급 (POST /internal/wallets).
 *
 * 같은 파생 인덱스로 몇 번을 불러도 같은 주소가 나오고 시드도 한 번만 나가므로
 * 재시도해도 안전하다. (blockchain/DESIGN.md 4-3)
 */
@Component
@RequiredArgsConstructor
public class BlockchainWalletClient {

    private static final String CREATE_WALLET_PATH = "/internal/wallets";

    private final BlockchainRestClient blockchainRestClient;

    /**
     * 파생 인덱스로 지갑 주소를 만들고 시드 캣머니를 발행한다.
     *
     * @param seedAmount 발행할 캣머니. null 이면 주소만 계산한다
     */
    public WalletCreationResponse createWallet(int derivationIndex, BigInteger seedAmount) {
        Map<String, Object> body = seedAmount == null
                ? Map.of("derivationIndex", derivationIndex)
                : Map.of("derivationIndex", derivationIndex, "seedAmount", seedAmount.toString());

        WalletCreationResponse response = blockchainRestClient.post(
                CREATE_WALLET_PATH, body, WalletCreationResponse.class, WalletErrorCode.WALLET_CREATION_FAILED);

        if (response.address() == null) {
            throw new BusinessException(WalletErrorCode.WALLET_CREATION_FAILED);
        }

        return response;
    }
}
