package com.teacat.server.wallet.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.wallet.entity.CatMoneyHold;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import com.teacat.server.wallet.exception.WalletErrorCode;
import com.teacat.server.wallet.repository.CatMoneyHoldRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CatMoneyHoldServiceIntegrationTests extends PostgresIntegrationTest {

    @Autowired
    private CatMoneyHoldRepository holdRepository;

    @Autowired
    private CatMoneyHoldService holdService;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private CatMoneyService catMoneyService;

    @Test
    void 유효_홀드_합계는_ACTIVE_만_더한다() {
        Long userId = insertUser("u@test.com", "유저");
        holdRepository.save(CatMoneyHold.create(userId, 300, CatMoneyHoldRefType.AUCTION_BID, 1L));
        CatMoneyHold released = holdRepository.save(
                CatMoneyHold.create(userId, 500, CatMoneyHoldRefType.AUCTION_BID, 2L));
        released.release();
        holdRepository.save(released);

        assertThat(holdRepository.sumActiveAmount(userId)).isEqualTo(300L);
        assertThat(holdRepository.sumActiveAmount(999L)).isZero();
    }

    @Test
    void 홀드_상태_전이는_한_번만_일어난다() {
        CatMoneyHold hold = CatMoneyHold.create(1L, 100, CatMoneyHoldRefType.AUCTION_BID, 1L);

        assertThat(hold.release()).isTrue();
        assertThat(hold.release()).isFalse();
        assertThat(hold.capture()).isFalse();
        assertThat(hold.isActive()).isFalse();
    }

    @Test
    void 가용_잔액은_체인_잔액에서_유효_홀드를_뺀_값이다() {
        Long userId = insertFundedUser("u@test.com", "유저", 1_500);
        holdRepository.save(CatMoneyHold.create(userId, 400, CatMoneyHoldRefType.AUCTION_BID, 1L));

        assertThat(holdService.availableBalance(userId)).isEqualTo(1_100L);
    }

    @Test
    void 가용_잔액이_부족하면_홀드하지_않는다() {
        Long userId = insertFundedUser("u@test.com", "유저", 1_000);

        assertThatThrownBy(() -> transactionTemplate.executeWithoutResult(tx ->
                holdService.hold(userId, 1_001, CatMoneyHoldRefType.AUCTION_BID, 1L)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(WalletErrorCode.INSUFFICIENT_BALANCE);
        assertThat(holdRepository.sumActiveAmount(userId)).isZero();
    }

    @Test
    void 홀드_후_해제하면_가용_잔액이_돌아오고_다시_해제해도_무해하다() {
        Long userId = insertFundedUser("u@test.com", "유저", 1_000);

        transactionTemplate.executeWithoutResult(tx ->
                holdService.hold(userId, 700, CatMoneyHoldRefType.AUCTION_BID, 10L));
        assertThat(holdService.availableBalance(userId)).isEqualTo(300L);

        Boolean first = transactionTemplate.execute(tx ->
                holdService.release(CatMoneyHoldRefType.AUCTION_BID, 10L));
        Boolean second = transactionTemplate.execute(tx ->
                holdService.release(CatMoneyHoldRefType.AUCTION_BID, 10L));

        assertThat(first).isTrue();
        assertThat(second).isFalse();
        assertThat(holdService.availableBalance(userId)).isEqualTo(1_000L);
    }

    @Test
    void 캡처된_홀드는_해제할_수_없다() {
        Long userId = insertFundedUser("u@test.com", "유저", 1_000);
        transactionTemplate.executeWithoutResult(tx ->
                holdService.hold(userId, 700, CatMoneyHoldRefType.AUCTION_BUY_NOW, 5L));

        Boolean captured = transactionTemplate.execute(tx ->
                holdService.capture(CatMoneyHoldRefType.AUCTION_BUY_NOW, 5L));
        Boolean released = transactionTemplate.execute(tx ->
                holdService.release(CatMoneyHoldRefType.AUCTION_BUY_NOW, 5L));

        assertThat(captured).isTrue();
        assertThat(released).isFalse();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT status::text FROM cat_money_holds WHERE ref_type = 'AUCTION_BUY_NOW' AND ref_id = 5",
                String.class)).isEqualTo("CAPTURED");
    }

    @Test
    void 트랜잭션_밖에서_홀드를_부르면_거절된다() {
        Long userId = insertFundedUser("u@test.com", "유저", 1_000);

        assertThatThrownBy(() -> holdService.hold(userId, 1, CatMoneyHoldRefType.AUCTION_BID, 1L))
                .isInstanceOf(IllegalTransactionStateException.class);
    }

    @Test
    void 잔액_응답에_묶인_금액과_가용_잔액이_실린다() {
        // 설계 8-3 의 표준 예시: 5만 있고 4만을 경매에 걸면 쓸 수 있는 돈은 1만이다
        Long userId = insertFundedUser("u@test.com", "유저", 50_000);
        holdRepository.save(CatMoneyHold.create(userId, 40_000, CatMoneyHoldRefType.AUCTION_BID, 1L));

        var response = catMoneyService.getBalance(userId);

        assertThat(response.balance()).isEqualTo(java.math.BigInteger.valueOf(50_000));
        assertThat(response.held()).isEqualTo(40_000L);
        assertThat(response.available()).isEqualTo(10_000L);
        assertThat(response.symbol()).isEqualTo("CAT");
    }

    @Test
    void 가용_잔액은_음수로_내려가지_않는다() {
        // 지갑에서 직접 코인을 빼는 등 판정 창구를 안 타는 지출이 있으면 장부가 어긋날 수 있다.
        // 그때도 화면에는 0 을 보여준다 (설계 8-3).
        Long userId = insertFundedUser("u@test.com", "유저", 1_000);
        holdRepository.save(CatMoneyHold.create(userId, 3_000, CatMoneyHoldRefType.AUCTION_BID, 1L));

        var response = catMoneyService.getBalance(userId);

        assertThat(response.held()).isEqualTo(3_000L);
        assertThat(response.available()).isZero();
    }
}
