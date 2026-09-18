package com.teacat.server.wallet.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.user.entity.User;
import com.teacat.server.wallet.client.BlockchainProperties;
import com.teacat.server.wallet.entity.Wallet;
import com.teacat.server.wallet.entity.WalletOwner;
import com.teacat.server.wallet.entity.WalletProvision;
import com.teacat.server.wallet.exception.WalletErrorCode;
import com.teacat.server.wallet.messaging.WalletProvisionRequestedEvent;
import com.teacat.server.wallet.repository.WalletOwnerRepository;
import com.teacat.server.wallet.repository.WalletProvisionRepository;
import com.teacat.server.wallet.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 지갑 발급 요청과 조회.
 *
 * <p>가입 트랜잭션은 {@link #requestProvision} 으로 PENDING 행만 남긴다. 실제 발급은 커밋 뒤
 * 큐 소비자가 {@link WalletProvisioner} 로 한다. 그래서 가입 응답은 블록체인 서비스 속도와 무관하고,
 * 블록체인 서비스가 죽어 있어도 가입은 된다.
 *
 * <p>대신 지갑이 준비될 때까지(보통 1초 안) "지갑 없는 회원" 이 잠깐 존재한다. 그 사이 지갑을 쓰려 하면
 * {@link WalletErrorCode#WALLET_PROVISIONING} 으로 거절되고, 사용자는 잠시 뒤 다시 하면 된다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WalletService {

    private final WalletProvisionRepository walletProvisionRepository;
    private final WalletOwnerRepository walletOwnerRepository;
    private final WalletRepository walletRepository;
    private final BlockchainProperties blockchainProperties;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * 지갑 발급을 요청한다. 반드시 가입 트랜잭션 안에서 부른다({@link Propagation#MANDATORY}).
     *
     * <p>요청 행은 회원과 함께 커밋되고, 큐 메시지는 <b>커밋이 끝난 뒤에만</b> 나간다
     * ({@code WalletProvisionPublisher} 의 AFTER_COMMIT). 가입이 롤백되면 메시지도 나가지 않는다 —
     * 없는 회원에게 지갑을 만들고 1,500 CAT 을 보내는 일이 없다.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void requestProvision(User user) {
        WalletProvision provision = walletProvisionRepository.save(WalletProvision.pending(user));
        eventPublisher.publishEvent(new WalletProvisionRequestedEvent(provision.getId()));
        log.info("지갑 발급 요청 userId={} provisionId={}", user.getId(), provision.getId());
    }

    /**
     * 회원의 지갑.
     *
     * <p>체인에 무언가를 보낼 때 받는 주소로 쓴다. 지갑이 없으면 조용히 넘기지 않는다 —
     * 준비 중인지 아예 없는지를 {@link #walletMissing} 이 가른다.
     *
     * <p>{@code CatMoneyService} 는 소각 때문에 파생 인덱스까지 필요해 자기 조회를 따로 갖고
     * 있다. 여기는 주소만 필요한 쪽이 쓴다.
     */
    @Transactional(readOnly = true)
    public Wallet resolveWallet(Long userId) {
        WalletOwner owner = walletOwnerRepository.findByUserId(userId)
                .orElseThrow(() -> walletMissing(userId));

        return walletRepository.findByOwnerIdAndChainId(owner.getId(), blockchainProperties.chainId())
                .orElseThrow(() -> walletMissing(userId));
    }

    @Transactional(readOnly = true)
    public String resolveAddress(Long userId) {
        return resolveWallet(userId).getAddress();
    }

    /**
     * 지갑이 없을 때 던질 예외.
     *
     * <p>발급이 아직 진행 중이면 "준비 중"(잠시 뒤 다시 하면 된다), 요청조차 없으면 "없음"(고객센터 일이다).
     * 둘은 사용자에게 다른 말이어야 한다.
     */
    public BusinessException walletMissing(Long userId) {
        boolean provisioning = walletProvisionRepository.findByUserId(userId)
                .filter(provision -> !provision.isDone())
                .isPresent();
        return new BusinessException(
                provisioning ? WalletErrorCode.WALLET_PROVISIONING : WalletErrorCode.WALLET_NOT_FOUND);
    }
}
