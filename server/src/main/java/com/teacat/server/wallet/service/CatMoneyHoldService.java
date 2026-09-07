package com.teacat.server.wallet.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.wallet.entity.CatMoneyHold;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import com.teacat.server.wallet.exception.WalletErrorCode;
import com.teacat.server.wallet.repository.CatMoneyHoldLockRepository;
import com.teacat.server.wallet.repository.CatMoneyHoldRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 캣머니 홀드 원장.
 *
 * <b>캣머니를 "쓰겠다" 고 약속하는 모든 경로는 여기를 거친다.</b> 경매 입찰이 첫 손님이고,
 * 티켓 결제 등 다른 지출도 {@link #availableBalance} 로 판정해야 홀드가 의미를 가진다.
 *
 * 잔액은 저장하지 않는다. 체인 잔액에서 유효 홀드를 뺀 값을 매번 계산한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CatMoneyHoldService {

    private final CatMoneyService catMoneyService;
    private final CatMoneyHoldRepository holdRepository;
    private final CatMoneyHoldLockRepository lockRepository;

    /** 가용 잔액 = 체인 잔액 − 유효 홀드 합 */
    @Transactional(readOnly = true)
    public long availableBalance(Long userId) {
        return catMoneyService.chainBalance(userId) - holdRepository.sumActiveAmount(userId);
    }

    /**
     * 금액을 묶는다.
     *
     * 반드시 호출자 트랜잭션 안에서 불러야 한다({@link Propagation#MANDATORY}). 따로 커밋되면
     * "입찰은 없는데 돈은 묶인" 상태가 남는다. 호출자가 롤백하면 홀드도 함께 사라진다.
     *
     * @throws BusinessException {@link WalletErrorCode#INSUFFICIENT_BALANCE} 가용 잔액이 부족할 때
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public CatMoneyHold hold(Long userId, long amount, CatMoneyHoldRefType refType, Long refId) {
        // 같은 유저의 동시 홀드를 줄 세운다. 이 락 없이는 둘 다 "충분하다" 고 보고 합계가 잔액을 넘는다
        lockRepository.lockUser(userId);

        if (availableBalance(userId) < amount) {
            throw new BusinessException(WalletErrorCode.INSUFFICIENT_BALANCE);
        }
        return holdRepository.save(CatMoneyHold.create(userId, amount, refType, refId));
    }

    /**
     * 묶인 돈을 풀어준다 (입찰이 밀렸을 때, 즉시구매로 경매가 끝났을 때).
     *
     * @return 이 호출로 풀렸으면 true. 홀드가 없거나 이미 끝났으면 false — 예외가 아니다(멱등)
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean release(CatMoneyHoldRefType refType, Long refId) {
        return holdRepository.findByRefTypeAndRefId(refType, refId)
                .map(CatMoneyHold::release)
                .orElse(false);
    }

    /**
     * 묶인 돈을 실제로 가져간다 (낙찰, 즉시구매).
     *
     * <b>캣머니가 실제로 움직이는 유일한 지점이다.</b>
     * TODO(wallet): 체인 transfer API 가 생기면 여기서 구매자 → 판매자 transfer 를 보내고 capture_tx_hash 를 저장한다.
     *               확정 추적은 WalletSeedGrant 와 같은 방식으로 wallet 이 맡는다.
     *
     * @return 이 호출로 확정됐으면 true. 홀드가 없거나 이미 끝났으면 false (멱등)
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean capture(CatMoneyHoldRefType refType, Long refId) {
        return holdRepository.findByRefTypeAndRefId(refType, refId)
                .map(CatMoneyHold::capture)
                .orElse(false);
    }
}
