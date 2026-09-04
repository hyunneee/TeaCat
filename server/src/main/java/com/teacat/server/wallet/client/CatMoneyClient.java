package com.teacat.server.wallet.client;

import com.teacat.server.wallet.entity.CatTxReason;
import com.teacat.server.wallet.exception.WalletErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigInteger;
import java.util.Map;
import java.util.Optional;

/**
 * 캣머니 조회·발행 (/internal/tokens/catmoney/*).
 *
 * 잔액은 <b>저장하지 않는다.</b> 체인이 진실이고, 캐시하면 반드시 어긋난다.
 * (blockchain/DESIGN.md 5-3 "저장하지 않는 것")
 *
 * <p>쓰기는 <b>절대 동기로 끝나지 않는다.</b> 보냈다는 응답(202)을 받고 확정은 따로 확인한다
 * (blockchain/DESIGN.md 4-2). 소각(burn)은 티켓 결제가 붙을 때 여기에 추가한다.
 */
@Component
@RequiredArgsConstructor
public class CatMoneyClient {

    private static final String BALANCE_PATH = "/internal/tokens/catmoney/balance";
    private static final String MINT_PATH = "/internal/tokens/catmoney/mint";
    private static final String TX_PATH = "/internal/tx/";
    private static final String ADDRESS_PARAM = "address";

    private final BlockchainRestClient blockchainRestClient;

    public CatMoneyBalanceResult getBalance(String address) {
        return blockchainRestClient.get(
                BALANCE_PATH,
                Map.of(ADDRESS_PARAM, address),
                CatMoneyBalanceResult.class,
                WalletErrorCode.BALANCE_UNAVAILABLE);
    }

    /**
     * 발행. 같은 {@code operationKey} 로 다시 불러도 두 번 발행되지 않는다 (컨트랙트가 막는다).
     *
     * <p>받는 주소는 <b>반드시 우리가 파생한 지갑</b>이어야 한다. 외부 지갑에 발행하면 그
     * 캣머니는 영원히 회수할 수 없다 — 소각은 유저 본인 서명이 필요한데 서버는 그 키를 모른다.
     *
     * @param amount 정수 문자열로 보낸다. JSON number 로 보내면 큰 값에서 정밀도가 깨진다
     */
    public CatMoneyWriteResult mint(String operationKey, String to, BigInteger amount, CatTxReason reason) {
        Map<String, Object> body = Map.of(
                "operationKey", operationKey,
                "to", to,
                "amount", amount.toString(),
                "reason", reason.name());

        return blockchainRestClient.post(
                MINT_PATH, body, CatMoneyWriteResult.class, WalletErrorCode.MINT_FAILED);
    }

    /**
     * 확정 여부 조회.
     *
     * @return 체인이 이 해시를 모르면 비어 있다. 트랜잭션이 드롭됐다는 뜻이라 재전송해야 한다
     */
    public Optional<TxReportResult> findTxReport(String txHash) {
        return blockchainRestClient.getIfPresent(
                TX_PATH + txHash, TxReportResult.class, WalletErrorCode.TX_REPORT_UNAVAILABLE);
    }
}
