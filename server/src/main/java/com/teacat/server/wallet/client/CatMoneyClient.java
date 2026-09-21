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
 * (blockchain/DESIGN.md 4-2).
 */
@Component
@RequiredArgsConstructor
public class CatMoneyClient {

    private static final String BALANCE_PATH = "/internal/tokens/catmoney/balance";
    private static final String MINT_PATH = "/internal/tokens/catmoney/mint";
    private static final String BURN_PATH = "/internal/tokens/catmoney/burn";
    private static final String TRANSFER_PATH = "/internal/tokens/catmoney/transfer";
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
     * 소각. 티켓 결제와 원화 출금이 여기로 온다.
     *
     * <p><b>유저 본인의 키로 서명한다.</b> 컨트랙트에 {@code burnFrom} 이 없어서 admin 이라도 남의
     * 잔액을 태울 수 없고, 그래서 파생 인덱스가 필요하다. 블록체인 서비스가 그 인덱스로 만든 주소가
     * {@code from} 과 같은지 먼저 확인하므로, 둘이 어긋나면 태우기 전에 400 으로 막힌다.
     *
     * <p>멱등 키는 <b>호출자별</b>로 기록된다(mint 는 전역). 누구나 부를 수 있는 함수라 전역이면
     * 아무나 남의 결제 키를 미리 태워 막을 수 있기 때문이다 (blockchain/DESIGN.md 6장 ②).
     *
     * @param derivationIndex {@code from} 주소를 만든 파생 인덱스 (wallet_owners.derivation_index)
     */
    public CatMoneyWriteResult burn(String operationKey, String from, int derivationIndex,
            BigInteger amount, CatTxReason reason) {
        Map<String, Object> body = Map.of(
                "operationKey", operationKey,
                "from", from,
                "derivationIndex", derivationIndex,
                "amount", amount.toString(),
                "reason", reason.name());

        return blockchainRestClient.post(
                BURN_PATH, body, CatMoneyWriteResult.class, WalletErrorCode.BURN_FAILED);
    }

    /** 포카 마켓 정산용 유저 간 전송. 같은 operationKey 재요청은 체인에서 멱등 처리된다. */
    public CatMoneyWriteResult transfer(String operationKey, String from, int derivationIndex,
            String to, BigInteger amount, String tradeId) {
        Map<String, Object> body = Map.of(
                "operationKey", operationKey,
                "from", from,
                "derivationIndex", derivationIndex,
                "to", to,
                "amount", amount.toString(),
                "tradeId", tradeId);
        return blockchainRestClient.post(
                TRANSFER_PATH, body, CatMoneyWriteResult.class, WalletErrorCode.TRANSFER_FAILED);
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
