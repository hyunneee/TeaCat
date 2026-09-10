package com.teacat.server.wallet.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.user.entity.User;
import com.teacat.server.wallet.client.BlockchainProperties;
import com.teacat.server.wallet.client.BlockchainWalletClient;
import com.teacat.server.wallet.client.WalletCreationResponse;
import com.teacat.server.wallet.entity.Wallet;
import com.teacat.server.wallet.entity.WalletOwner;
import com.teacat.server.wallet.entity.WalletSeedGrant;
import com.teacat.server.wallet.entity.WalletSeedStatus;
import com.teacat.server.wallet.exception.WalletErrorCode;
import com.teacat.server.wallet.repository.WalletOwnerRepository;
import com.teacat.server.wallet.repository.WalletRepository;
import com.teacat.server.wallet.repository.WalletSeedGrantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.util.Locale;

/**
 * 가입 시 지갑 발급.
 *
 * <b>가입 트랜잭션 안에서 호출된다.</b> 여기서 실패하면 예외가 그대로 올라가
 * 회원 생성까지 함께 롤백되고, 사용자는 다시 가입을 시도할 수 있다.
 * 지갑 없는 회원이 남으면 티켓·캣머니를 받을 수 없으므로 반쪽짜리 가입을 허용하지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WalletService {

    /** 가입 축하금 (API-101). 금액은 서버가 정한다 — 블록체인 서비스는 판단하지 않는다 */
    private static final BigInteger SIGNUP_SEED_AMOUNT = BigInteger.valueOf(1_500);

    private final BlockchainWalletClient blockchainWalletClient;
    private final BlockchainProperties blockchainProperties;
    private final WalletOwnerRepository walletOwnerRepository;
    private final WalletRepository walletRepository;
    private final WalletSeedGrantRepository walletSeedGrantRepository;

    /**
     * 회원에게 지갑을 만들고 가입 축하금을 발행한다.
     *
     * 반드시 가입 트랜잭션 안에서 불러야 한다({@link Propagation#MANDATORY}).
     * 따로 커밋되면 "지갑은 생겼는데 회원은 없는" 상태가 남는다.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void provision(User user) {
        // 시퀀스에서 뽑는다. 롤백돼도 되돌아가지 않으므로 인덱스가 재사용되지 않는다
        int derivationIndex = (int) walletOwnerRepository.nextDerivationIndex();

        // 체인 쪽을 먼저 부른다. 여기서 실패하면 DB 를 건드리지 않고 그대로 롤백된다
        WalletCreationResponse created = blockchainWalletClient.createWallet(derivationIndex, SIGNUP_SEED_AMOUNT);

        // 체크섬 주소가 섞여 오므로 소문자로 맞춘다 (DB 에 소문자 CHECK 이 있다)
        String address = created.address().toLowerCase(Locale.ROOT);

        WalletOwner owner = walletOwnerRepository.save(WalletOwner.create(user, derivationIndex, address));
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

        log.info("지갑 발급 완료 userId={} derivationIndex={} seed={}",
                user.getId(), derivationIndex, created.seed() == null ? "없음" : created.seed().status());
    }

    private WalletSeedStatus toSeedStatus(String status) {
        // 모르는 값이 오면 보낸 것으로 보고 PENDING 으로 둔다. 확정 폴링이 붙으면 거기서 정리된다
        return "ALREADY_DONE".equals(status) ? WalletSeedStatus.ALREADY_DONE : WalletSeedStatus.PENDING;
    }

    /**
     * 회원의 지갑 주소.
     *
     * <p>체인에 무언가를 보낼 때 받는 주소로 쓴다. 지갑이 없으면 조용히 넘기지 않는다 —
     * 가입이 반쪽으로 끝났다는 뜻이라 드러나야 한다.
     *
     * <p>{@code CatMoneyService} 는 소각 때문에 파생 인덱스까지 필요해 자기 조회를 따로 갖고
     * 있다. 여기는 주소만 필요한 쪽이 쓴다.
     */
    @Transactional(readOnly = true)
    public Wallet resolveWallet(Long userId) {
        WalletOwner owner = walletOwnerRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(WalletErrorCode.WALLET_NOT_FOUND));

        return walletRepository.findByOwnerIdAndChainId(owner.getId(), blockchainProperties.chainId())
                .orElseThrow(() -> new BusinessException(WalletErrorCode.WALLET_NOT_FOUND));
    }

    @Transactional(readOnly = true)
    public String resolveAddress(Long userId) {
        return resolveWallet(userId).getAddress();
    }
}
