package com.teacat.server.wallet.service;

import com.teacat.server.wallet.client.BlockchainProperties;
import com.teacat.server.wallet.client.WalletCreationResponse;
import com.teacat.server.wallet.entity.Wallet;
import com.teacat.server.wallet.entity.WalletOwner;
import com.teacat.server.wallet.entity.WalletProvision;
import com.teacat.server.wallet.entity.WalletSeedGrant;
import com.teacat.server.wallet.entity.WalletSeedStatus;
import com.teacat.server.wallet.repository.WalletOwnerRepository;
import com.teacat.server.wallet.repository.WalletProvisionRepository;
import com.teacat.server.wallet.repository.WalletRepository;
import com.teacat.server.wallet.repository.WalletSeedGrantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.util.Locale;
import java.util.Optional;

/**
 * 지갑 발급의 DB 쪽 단계. 체인 호출 앞뒤로 <b>짧은 트랜잭션 두 개</b>로 나뉜다.
 *
 * <p>체인 호출을 트랜잭션 안에 두지 않는 이유는 가입 때와 같다. 블록체인 서비스가 느리면
 * 그 시간만큼 DB 커넥션을 물게 된다. 순서를 지키는 건 {@link WalletProvisioner} 다.
 */
@Component
@RequiredArgsConstructor
public class WalletProvisionRecorder {

    private final WalletProvisionRepository walletProvisionRepository;
    private final WalletOwnerRepository walletOwnerRepository;
    private final WalletRepository walletRepository;
    private final WalletSeedGrantRepository walletSeedGrantRepository;
    private final BlockchainProperties blockchainProperties;

    /**
     * 1단계. 파생 인덱스를 확보해 행에 <b>먼저 저장</b>한다.
     *
     * <p>이미 인덱스가 있으면(재시도) 그 값을 그대로 돌려준다. 그래야 체인이 같은 주소를 내고
     * 시드도 ALREADY_DONE 으로 답한다. 이미 끝난 행이면 비어 있는 값을 돌려준다.
     */
    @Transactional
    public Optional<Integer> claimDerivationIndex(Long provisionId) {
        WalletProvision provision = load(provisionId);
        if (provision.isDone()) {
            return Optional.empty();
        }
        if (!provision.hasDerivationIndex()) {
            provision.assignDerivationIndex((int) walletOwnerRepository.nextDerivationIndex());
        }
        return Optional.of(provision.getDerivationIndex());
    }

    /**
     * 2단계. 체인 응답을 지갑 행으로 남기고 DONE 으로 올린다.
     *
     * @return 이번 호출이 지갑을 만들었으면 true. 다른 소비자가 먼저 끝냈으면 false
     */
    @Transactional
    public boolean complete(Long provisionId, WalletCreationResponse created) {
        WalletProvision provision = load(provisionId);
        if (provision.isDone()) {
            return false;
        }

        // 체크섬 주소가 섞여 오므로 소문자로 맞춘다 (DB 에 소문자 CHECK 이 있다)
        String address = created.address().toLowerCase(Locale.ROOT);

        WalletOwner owner = walletOwnerRepository.save(
                WalletOwner.create(provision.getUser(), provision.getDerivationIndex(), address));
        Wallet wallet = walletRepository.save(
                Wallet.relayerEoa(owner, blockchainProperties.chainId(), address));

        if (created.seed() != null) {
            walletSeedGrantRepository.save(WalletSeedGrant.of(
                    wallet,
                    new BigInteger(created.seed().amount()),
                    toSeedStatus(created.seed().status()),
                    created.seed().txHash()
            ));
        }

        provision.markDone();
        return true;
    }

    /** 체인 호출이 실패했다. 행은 PENDING 으로 남고 스위퍼가 다시 집는다 */
    @Transactional
    public void recordFailure(Long provisionId, String message) {
        load(provisionId).recordFailure(message);
    }

    private WalletProvision load(Long provisionId) {
        return walletProvisionRepository.findByIdForUpdate(provisionId)
                .orElseThrow(() -> new IllegalArgumentException("지갑 발급 요청이 없습니다. provisionId=" + provisionId));
    }

    private WalletSeedStatus toSeedStatus(String status) {
        // 모르는 값이 오면 보낸 것으로 보고 PENDING 으로 둔다. 확정 폴링이 붙으면 거기서 정리된다
        return "ALREADY_DONE".equals(status) ? WalletSeedStatus.ALREADY_DONE : WalletSeedStatus.PENDING;
    }
}
