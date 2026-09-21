package com.teacat.server.wallet.service;

import com.teacat.server.wallet.client.BlockchainWalletClient;
import com.teacat.server.wallet.client.WalletCreationResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.util.Optional;

/**
 * 지갑 발급 요청 하나를 끝까지 처리한다. 큐 소비자와 스위퍼가 부른다.
 *
 * <pre>
 *   1. 인덱스 확보 (DB 트랜잭션)   — 이미 DONE 이면 여기서 끝
 *   2. 체인 호출   (트랜잭션 밖)   — 지갑 주소 파생 + 시드 발행 제출
 *   3. 지갑 기록   (DB 트랜잭션)   — wallet_owners / wallets / wallet_seed_grants, DONE
 * </pre>
 *
 * <p>2 가 실패하면 시도 횟수와 이유만 남기고 예외를 그대로 올린다. 행은 PENDING 으로 남아
 * 스위퍼가 다시 집고, 그때는 1 에서 같은 인덱스를 받아 체인이 ALREADY_DONE 으로 답한다.
 *
 * <p>{@code NOT_SUPPORTED}: 부르는 쪽이 트랜잭션을 열어 두었더라도 체인 호출은 그 밖에서 한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WalletProvisioner {

    /** 가입 축하금 (API-101). 금액은 서버가 정한다 — 블록체인 서비스는 판단하지 않는다 */
    static final BigInteger SIGNUP_SEED_AMOUNT = BigInteger.valueOf(1_500);

    private final WalletProvisionRecorder recorder;
    private final BlockchainWalletClient blockchainWalletClient;

    /**
     * @return 이번 호출이 지갑을 만들었으면 true. 이미 끝나 있었으면 false
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public boolean provision(Long provisionId) {
        Optional<Integer> index = recorder.claimDerivationIndex(provisionId);
        if (index.isEmpty()) {
            log.debug("지갑 발급이 이미 끝나 있어 건너뜁니다. provisionId={}", provisionId);
            return false;
        }

        WalletCreationResponse created;
        try {
            created = blockchainWalletClient.createWallet(index.get(), SIGNUP_SEED_AMOUNT);
        } catch (RuntimeException e) {
            recorder.recordFailure(provisionId, e.getMessage());
            throw e;
        }

        boolean done = recorder.complete(provisionId, created);
        if (done) {
            log.info("지갑 발급 완료 provisionId={} derivationIndex={} seed={}",
                    provisionId, index.get(), created.seed() == null ? "없음" : created.seed().status());
        }
        return done;
    }
}
