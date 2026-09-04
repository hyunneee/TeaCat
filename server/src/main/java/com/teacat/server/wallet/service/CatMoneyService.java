package com.teacat.server.wallet.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.wallet.client.CatMoneyClient;
import com.teacat.server.wallet.client.BlockchainProperties;
import com.teacat.server.wallet.dto.response.BalanceResponse;
import com.teacat.server.wallet.entity.Wallet;
import com.teacat.server.wallet.entity.WalletOwner;
import com.teacat.server.wallet.exception.WalletErrorCode;
import com.teacat.server.wallet.repository.WalletOwnerRepository;
import com.teacat.server.wallet.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 캣머니 조회.
 *
 * <b>잔액이 필요한 곳은 전부 여기를 부릅니다.</b> 화면(마이페이지·포카 마켓)뿐 아니라
 * 결제처럼 서버 안에서 잔액을 봐야 하는 도메인도 HTTP 가 아니라 이 서비스를 직접 부릅니다.
 * 그래야 "지갑 주소를 어떻게 찾는가" 가 한 곳에만 있습니다.
 *
 * 잔액은 저장하지 않습니다. 체인이 진실이고 캐시하면 반드시 어긋납니다
 * (blockchain/DESIGN.md 5-3).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CatMoneyService {

    private final WalletOwnerRepository walletOwnerRepository;
    private final WalletRepository walletRepository;
    private final BlockchainProperties blockchainProperties;
    private final CatMoneyClient catMoneyClient;

    public BalanceResponse getBalance(Long userId) {
        return BalanceResponse.from(catMoneyClient.getBalance(resolveAddress(userId)));
    }

    /**
     * 유저 → 지갑 주소.
     *
     * 지갑이 없으면 조용히 0 으로 넘기지 않는다. "잔액 0" 과 "지갑이 없음" 은 다른 상태이고,
     * 후자는 가입이 반쪽으로 끝났다는 뜻이라 드러나야 한다.
     */
    private String resolveAddress(Long userId) {
        WalletOwner owner = walletOwnerRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(WalletErrorCode.WALLET_NOT_FOUND));

        Wallet wallet = walletRepository.findByOwnerIdAndChainId(owner.getId(), blockchainProperties.chainId())
                .orElseThrow(() -> new BusinessException(WalletErrorCode.WALLET_NOT_FOUND));

        return wallet.getAddress();
    }
}
