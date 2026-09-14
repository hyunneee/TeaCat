package com.teacat.server.wallet.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import com.teacat.server.wallet.dto.response.AdminCatMoneyAdjustResponse;
import com.teacat.server.wallet.dto.response.BalanceResponse;
import com.teacat.server.wallet.entity.CatTransaction;
import com.teacat.server.wallet.entity.CatTxReason;
import com.teacat.server.wallet.exception.WalletErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigInteger;
import java.util.UUID;

/**
 * 관리자가 특정 회원의 캣머니를 넣거나 뺀다 — <b>테스트용</b>이다.
 *
 * <p>결제·충전을 거치지 않고 잔액을 만들어 주는 유일한 경로다. QA 가 예매·경매·포카 마켓을
 * 돌려보려면 돈이 있어야 하는데, 매번 토스 결제창을 태울 수는 없어서 둔다.
 *
 * <p>🔴 <b>여기서 만든 돈은 원화와 짝이 없다.</b> 그래서 {@link CatTxReason#ADMIN_GRANT} ·
 * {@link CatTxReason#ADMIN_BURN} 이라는 사유를 따로 두었다. 기존 사유를 빌려 쓰면 원장이
 * 거짓말을 한다 — REWARD 로 적으면 이벤트 지급액에 테스트 금액이 섞이고, WITHDRAWAL 로
 * 적으면 있지도 않은 원화 출금이 장부에 남는다. 매출 집계는 이 두 사유를 빼야 한다.
 *
 * <p><b>접근 제어는 {@code SecurityConfig} 의 {@code /admin/**} 규칙(ADMIN 전용)이 맡는다.</b>
 * 여기서 역할을 다시 검사하지 않는다.
 *
 * <p>⚠️ 사용자 본인 확인이나 한도 승인 같은 장치가 없다. 관리자 계정이 털리면 캣머니를 무한히
 * 찍을 수 있다는 뜻이다 — 지금은 그렇게 쓰기로 했고({@code /admin/**} 만 통과하면 된다),
 * 실서비스로 간다면 이 API 를 설정으로 닫을 수 있게 해야 한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminCatMoneyService {

    private final CatMoneyService catMoneyService;
    private final CatMoneyHoldService catMoneyHoldService;
    private final UserRepository userRepository;

    /** 관리자가 보는 잔액. 회원 본인이 보는 값과 같은 계산이다 (체인 잔액 − 홀드 − 미확정 소각) */
    public BalanceResponse getBalance(Long userId) {
        requireUser(userId);
        return catMoneyService.getBalance(userId);
    }

    /**
     * 캣머니를 넣어준다.
     *
     * <p>요청한 금액이 그대로 나간다 — 발행에는 상한이 없다(컨트랙트도 막지 않는다).
     * 오타로 0 을 더 붙이는 사고는 요청 DTO 의 상한이 막는다.
     */
    public AdminCatMoneyAdjustResponse grant(Long actorId, Long userId, long amount) {
        requireUser(userId);

        CatTransaction transaction = catMoneyService.mint(
                userId,
                BigInteger.valueOf(amount),
                CatTxReason.ADMIN_GRANT,
                operationKey("admin-grant", actorId, userId));

        log.info("관리자가 캣머니를 지급했습니다. actorId={} userId={} amount={} status={}",
                actorId, userId, amount, transaction.getStatus());

        return AdminCatMoneyAdjustResponse.of(userId, transaction, amount);
    }

    /**
     * 캣머니를 뺀다. <b>가용 잔액보다 많이 요청하면 가용 잔액만큼만 깎는다.</b>
     *
     * <p>깎는 쪽을 고른 이유는 "0 으로 만들기" 가 이 기능의 주 용도이기 때문이다 — 넉넉한 수를
     * 넣으면 남은 돈이 전부 빠진다. 대신 요청한 금액과 실제로 빠진 금액이 다를 수 있어,
     * 응답이 둘을 모두 돌려주고 화면이 그 차이를 말해준다.
     *
     * <p>빼는 기준이 체인 잔액이 아니라 <b>가용 잔액</b>인 것이 중요하다. 경매 입찰로 묶인 돈과
     * 아직 확정되지 않은 소각은 체인 잔액에 남아 있지만 이미 임자가 있다. 체인 잔액 기준으로
     * 태우면 그 돈까지 가져가서, 정작 낙찰·결제가 확정될 때 잔액이 모자라게 된다.
     *
     * <p>⚠️ 판정과 소각 사이에 회원이 다른 결제를 하면 어긋날 수 있다. 홀드처럼 락을 잡지
     * 않는데, 관리자가 쓰는 테스트 도구라 그 창을 감수한다 — 어긋나면 체인이 거절한다.
     */
    public AdminCatMoneyAdjustResponse burn(Long actorId, Long userId, long amount) {
        requireUser(userId);

        long available = catMoneyHoldService.availableBalance(userId);

        /* 0 을 태우는 요청은 보내지 않는다. 체인도 원장 CHECK(amount > 0)도 거절하는데,
           거기까지 가면 "빼기를 눌렀는데 500" 이 된다. 여기서 이유를 말해주고 끝낸다 */
        if (available <= 0) {
            throw new BusinessException(WalletErrorCode.INSUFFICIENT_BALANCE);
        }

        long applied = Math.min(amount, available);

        CatTransaction transaction = catMoneyService.burn(
                userId,
                BigInteger.valueOf(applied),
                CatTxReason.ADMIN_BURN,
                operationKey("admin-burn", actorId, userId));

        log.info("관리자가 캣머니를 소각했습니다. actorId={} userId={} requested={} applied={} status={}",
                actorId, userId, amount, applied, transaction.getStatus());

        return AdminCatMoneyAdjustResponse.of(userId, transaction, amount);
    }

    /**
     * 멱등 키. 누를 때마다 새로 만든다.
     *
     * <p>충전·결제는 주문 PK 를 키로 써서 재시도가 안전하다. 여기엔 그럴 PK 가 없다 — 조정을
     * 담는 테이블이 따로 없고, 관리자가 <b>같은 금액을 두 번 넣는 것도 정상</b>이기 때문이다.
     * 고정 키를 쓰면 두 번째 지급이 조용히 무시된다(ALREADY_DONE).
     *
     * <p>그 대가로 <b>네트워크 재시도는 두 번 발행된다.</b> 버튼을 두 번 누르면 두 번 나간다.
     * 테스트 도구라 감수하고, 화면이 요청 중에 버튼을 잠가서 줄인다.
     *
     * <p>누가 누구에게 했는지 키에 남긴다 — 원장만 보고도 추적된다. 비밀값은 넣지 않는다
     * (keccak256 해시가 체인에 영구히 남는다).
     */
    private String operationKey(String prefix, Long actorId, Long userId) {
        return "%s:%d:%d:%s".formatted(prefix, actorId, userId, UUID.randomUUID());
    }

    /**
     * 없는 회원에게 발행하지 않는다.
     *
     * <p>{@link CatMoneyService} 도 지갑을 못 찾으면 막지만, 그때 나오는 말은 "지갑이 없습니다"
     * 라서 관리자가 회원 ID 를 잘못 넣은 것인지 지갑 발급이 실패한 계정인지 구분할 수 없다.
     */
    private void requireUser(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new BusinessException(UserErrorCode.USER_NOT_FOUND);
        }
    }
}
