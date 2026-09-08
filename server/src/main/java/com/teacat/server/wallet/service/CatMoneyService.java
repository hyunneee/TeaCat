package com.teacat.server.wallet.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import com.teacat.server.wallet.client.BlockchainProperties;
import com.teacat.server.wallet.client.CatMoneyClient;
import com.teacat.server.wallet.client.CatMoneyWriteResult;
import com.teacat.server.wallet.client.TxReportResult;
import com.teacat.server.wallet.dto.response.BalanceResponse;
import com.teacat.server.wallet.entity.CatTransaction;
import com.teacat.server.wallet.entity.CatTxReason;
import com.teacat.server.wallet.entity.CatTxStatus;
import com.teacat.server.wallet.entity.Wallet;
import com.teacat.server.wallet.entity.WalletOwner;
import com.teacat.server.wallet.exception.WalletErrorCode;
import com.teacat.server.wallet.repository.CatMoneyHoldRepository;
import com.teacat.server.wallet.repository.CatTransactionRepository;
import com.teacat.server.wallet.repository.WalletOwnerRepository;
import com.teacat.server.wallet.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.util.Optional;

/**
 * 캣머니 조회·발행.
 *
 * <b>잔액이 필요한 곳은 전부 여기를 부릅니다.</b> 화면(마이페이지·포카 마켓)뿐 아니라
 * 결제처럼 서버 안에서 잔액을 봐야 하는 도메인도 HTTP 가 아니라 이 서비스를 직접 부릅니다.
 * 그래야 "지갑 주소를 어떻게 찾는가" 가 한 곳에만 있습니다.
 *
 * 지출 가능 여부는 {@link CatMoneyHoldService#availableBalance} 로 판정합니다. 체인 잔액에는
 * 입찰로 묶인 돈과 아직 확정되지 않은 소각이 그대로 남아 있어, 그대로 쓰면 같은 돈을 두 번 쓰게
 * 됩니다. 화면에 보여줄 잔액도 balance 가 아니라 available 입니다.
 *
 * 잔액은 저장하지 않습니다. 체인이 진실이고 캐시하면 반드시 어긋납니다
 * (blockchain/DESIGN.md 5-3).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CatMoneyService {

    private final WalletOwnerRepository walletOwnerRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final CatTransactionRepository catTransactionRepository;
    private final BlockchainProperties blockchainProperties;
    private final CatMoneyClient catMoneyClient;
    private final CatMoneyHoldRepository holdRepository;

    public BalanceResponse getBalance(Long userId) {
        return BalanceResponse.of(
                catMoneyClient.getBalance(resolveAddress(userId)),
                holdRepository.sumActiveAmount(userId));
    }

    /**
     * 체인이 말하는 잔액. 묶인 돈도 미확정 소각도 빼지 않은 원시값이다.
     *
     * 지출 판정에 이 값을 직접 쓰지 말고 {@link CatMoneyHoldService#availableBalance} 를 쓴다.
     */
    public long chainBalance(Long userId) {
        return new BigInteger(catMoneyClient.getBalance(resolveAddress(userId)).balance()).longValueExact();
    }

    /**
     * 보냈지만 아직 확정되지 않은 소각 합계.
     *
     * <p>체인 잔액에는 아직 안 빠져 있지만 <b>이미 나간 돈</b>이다. 소각을 보내고 확정되기까지
     * 블록 하나(10초)가 걸리는데, 그 사이 체인 잔액은 예전 값이라 빼주지 않으면 같은 돈을 두 번
     * 쓸 수 있다. {@link CatMoneyHoldService#availableBalance} 가 이 값을 쓴다.
     *
     * <p>반대로 아직 확정되지 않은 <b>발행</b>은 더하지 않는다. 실패할 수 있는 돈을 미리 쓰게 하면
     * 안 된다 — 충전 직후 잠깐 잔액에 안 잡히는 편이 낫다.
     */
    public long pendingBurns(Long userId) {
        return catTransactionRepository.sumPendingBurns(userId).longValueExact();
    }

    /**
     * 캣머니를 발행하고 그 요청을 원장에 남깁니다.
     *
     * <p><b>트랜잭션 밖에서 돕니다.</b> 체인에 다녀오는 동안(최대 20초) DB 커넥션을 잡고 있으면
     * 풀이 마릅니다. 저장은 리포지토리가 각자 짧은 트랜잭션으로 처리합니다.
     *
     * @param operationKey 우리가 정하는 영구 유일 키. 같은 키로 다시 불러도 두 번 발행되지 않습니다.
     *                     비밀값을 넣으면 안 됩니다 — 해시가 체인에 영구히 남습니다
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public CatTransaction mint(Long userId, BigInteger amount, CatTxReason reason, String operationKey) {
        // 재시도로 다시 들어온 경우. 체인은 멱등이지만 원장에 같은 키가 두 줄 생기면 안 된다
        Optional<CatTransaction> recorded = catTransactionRepository.findByOperationKey(operationKey);
        if (recorded.isPresent()) {
            return recorded.get();
        }

        Wallet wallet = resolveWallet(userId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));

        CatMoneyWriteResult result = catMoneyClient.mint(operationKey, wallet.getAddress(), amount, reason);

        CatTransaction transaction = result.isPending()
                ? CatTransaction.sent(user, wallet, reason, amount, operationKey, result.txHash())
                : CatTransaction.alreadyDone(user, wallet, reason, amount, operationKey);

        return catTransactionRepository.save(transaction);
    }

    /**
     * 캣머니를 소각하고 그 요청을 원장에 남깁니다.
     *
     * <p>{@link #mint} 와 같은 이유로 <b>트랜잭션 밖에서</b> 돕니다.
     *
     * <p><b>쓸 수 있는지 먼저 확인하는 것은 부르는 쪽 책임입니다.</b> 여기서는 확인하지 않습니다 —
     * 잔액 판정과 소각 사이에 다른 요청이 끼지 않으려면 호출자의 트랜잭션·락 안에서 판정이
     * 끝나 있어야 하기 때문입니다 ({@link CatMoneyHoldService#availableBalance}).
     * 체인도 잔액이 모자라면 거절하지만 그건 마지막 방어선이고, 거기까지 갔다면 우리 판정이
     * 체인과 어긋났다는 뜻이라 사람이 봐야 합니다.
     *
     * @param operationKey 우리가 정하는 영구 유일 키. 같은 키로 다시 불러도 두 번 태우지 않습니다
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public CatTransaction burn(Long userId, BigInteger amount, CatTxReason reason, String operationKey) {
        // 재시도로 다시 들어온 경우. 체인은 멱등이지만 원장에 같은 키가 두 줄 생기면 안 된다
        Optional<CatTransaction> recorded = catTransactionRepository.findByOperationKey(operationKey);
        if (recorded.isPresent()) {
            return recorded.get();
        }

        WalletRef ref = resolveWalletRef(userId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));

        CatMoneyWriteResult result = catMoneyClient.burn(operationKey, ref.wallet().getAddress(),
                ref.owner().getDerivationIndex(), amount, reason);

        CatTransaction transaction = result.isPending()
                ? CatTransaction.sent(user, ref.wallet(), reason, amount, operationKey, result.txHash())
                : CatTransaction.alreadyDone(user, ref.wallet(), reason, amount, operationKey);

        return catTransactionRepository.save(transaction);
    }

    /**
     * 확정 여부를 체인에 물어 원장에 반영합니다. 확정 폴링이 건별로 부릅니다.
     *
     * @return 아직 확정되지 않았으면 false (다음 차례에 다시 봅니다)
     */
    @Transactional
    public boolean settle(Long catTransactionId) {
        CatTransaction transaction = catTransactionRepository.findById(catTransactionId).orElse(null);
        if (transaction == null || !transaction.isPending()) {
            return true;
        }

        // 보내긴 했는데 해시를 못 받은 건은 여기서 판단할 수 없다. 재발행 쪽이 처리한다
        if (transaction.getTxHash() == null) {
            return false;
        }

        Optional<TxReportResult> report = catMoneyClient.findTxReport(transaction.getTxHash());
        if (report.isEmpty()) {
            // 체인이 이 해시를 모른다 = 드롭됐다. 원장에 남은 요청은 재발행 대상이다
            log.warn("체인이 트랜잭션을 모릅니다. 재발행 대상입니다. catTransactionId={}", catTransactionId);
            return false;
        }

        CatTxStatus status = report.get().toCatTxStatus();
        if (!status.isSettled()) {
            return false;
        }

        transaction.settle(status, report.get().failureCode());
        if (status == CatTxStatus.FAILED) {
            log.error("캣머니 {} 이 체인에서 실패했습니다. catTransactionId={} reason={} code={}",
                    transaction.getDirection(), catTransactionId, transaction.getReason(),
                    report.get().failureCode());
        }

        return true;
    }

    /**
     * 유저 → 소유 키 + 지갑.
     *
     * 지갑이 없으면 조용히 0 으로 넘기지 않는다. "잔액 0" 과 "지갑이 없음" 은 다른 상태이고,
     * 후자는 가입이 반쪽으로 끝났다는 뜻이라 드러나야 한다.
     *
     * <p>소각은 유저 본인 키로 서명해야 해서 파생 인덱스({@link WalletOwner})까지 필요하다.
     * 그래서 지갑만 따로 찾지 않고 둘을 함께 돌려준다.
     */
    private WalletRef resolveWalletRef(Long userId) {
        WalletOwner owner = walletOwnerRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(WalletErrorCode.WALLET_NOT_FOUND));

        Wallet wallet = walletRepository.findByOwnerIdAndChainId(owner.getId(), blockchainProperties.chainId())
                .orElseThrow(() -> new BusinessException(WalletErrorCode.WALLET_NOT_FOUND));

        return new WalletRef(owner, wallet);
    }

    private String resolveAddress(Long userId) {
        return resolveWalletRef(userId).wallet().getAddress();
    }

    private Wallet resolveWallet(Long userId) {
        return resolveWalletRef(userId).wallet();
    }

    private record WalletRef(WalletOwner owner, Wallet wallet) {
    }
}
