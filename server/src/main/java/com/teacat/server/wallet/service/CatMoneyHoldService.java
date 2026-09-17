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

    /**
     * 가용 잔액 = 체인 잔액 − 유효 홀드 − 미확정 소각.
     *
     * <b>빼야 할 것이 두 가지다.</b> 둘 다 "체인 잔액에는 아직 남아 있지만 이미 임자가 있는 돈" 인데
     * 이유가 다르다.
     * <ul>
     *   <li><b>유효 홀드</b> — 입찰처럼 쓰겠다고 약속만 하고 아직 안 나간 돈
     *   <li><b>미확정 소각</b> — 이미 체인으로 보냈지만 확정(블록 10초)을 기다리는 돈
     * </ul>
     * 하나만 빼면 그쪽 경로와 다른 경로가 같은 돈을 두 번 쓴다. 예를 들어 티켓 결제로 소각을
     * 보낸 직후 경매에 입찰하면, 소각을 안 빼는 한 둘 다 잔액이 충분하다고 본다.
     */
    @Transactional(readOnly = true)
    public long availableBalance(Long userId) {
        return catMoneyService.chainBalance(userId)
                - holdRepository.sumActiveAmount(userId)
                - catMoneyService.pendingBurns(userId);
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

    /** 아직 체인에 들어오지 않은 판매대금을 먼저 잠가 보상 전 지출을 막는다. */
    @Transactional(propagation = Propagation.MANDATORY)
    public CatMoneyHold holdIncoming(Long userId, long amount, CatMoneyHoldRefType refType, Long refId) {
        lockRepository.lockUser(userId);
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
     * 온체인 전송이 확정된 홀드를 장부상 사용 완료로 바꾼다.
     *
     * 실제 구매자 → 판매자 전송과 확정 추적은 NFT 거래 정산 프로세서가 담당한다.
     * 외부 I/O를 DB 트랜잭션 밖에서 끝낸 뒤 이 메서드를 호출한다.
     *
     * @return 이 호출로 확정됐으면 true. 홀드가 없거나 이미 끝났으면 false (멱등)
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean capture(CatMoneyHoldRefType refType, Long refId) {
        return holdRepository.findByRefTypeAndRefId(refType, refId)
                .map(CatMoneyHold::capture)
                .orElse(false);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void recordCaptureTx(CatMoneyHoldRefType refType, Long refId, String txHash) {
        holdRepository.findByRefTypeAndRefId(refType, refId)
                .ifPresent(hold -> hold.recordCaptureTx(txHash));
    }
}
