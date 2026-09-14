package com.teacat.server.wallet.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.repository.UserRepository;
import com.teacat.server.wallet.dto.response.AdminCatMoneyAdjustResponse;
import com.teacat.server.wallet.entity.CatTransaction;
import com.teacat.server.wallet.entity.CatTxReason;
import com.teacat.server.wallet.entity.Wallet;
import com.teacat.server.wallet.exception.WalletErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * 관리자 캣머니 조정.
 *
 * <p>여기서 지키려는 것은 <b>얼마가 실제로 나가는가</b> 하나다. 빼기는 요청한 금액을 그대로
 * 쓰지 않고 가용 잔액으로 자르는데, 그 경계가 틀리면 남의 입찰금까지 태우거나(너무 많이)
 * 0 을 태우려다 500 이 난다(너무 적게).
 */
@ExtendWith(MockitoExtension.class)
class AdminCatMoneyServiceTests {

    private static final Long ACTOR_ID = 1L;
    private static final Long USER_ID = 42L;

    @Mock private CatMoneyService catMoneyService;
    @Mock private CatMoneyHoldService catMoneyHoldService;
    @Mock private UserRepository userRepository;

    @InjectMocks private AdminCatMoneyService adminCatMoneyService;

    /* ── 지급 ────────────────────────────────────────────────── */

    @Test
    void 지급은_요청한_금액을_그대로_발행한다() {
        given(userRepository.existsById(USER_ID)).willReturn(true);
        given(catMoneyService.mint(eq(USER_ID), any(), eq(CatTxReason.ADMIN_GRANT), anyString()))
                .willReturn(transaction(CatTxReason.ADMIN_GRANT, 50_000));

        AdminCatMoneyAdjustResponse response = adminCatMoneyService.grant(ACTOR_ID, USER_ID, 50_000);

        assertThat(response.requestedAmount()).isEqualTo(50_000);
        assertThat(response.appliedAmount()).isEqualTo(50_000);
        assertThat(response.reason()).isEqualTo(CatTxReason.ADMIN_GRANT);
    }

    /** 지급은 잔액을 볼 필요가 없다. 굳이 체인에 다녀오면 느려지기만 한다 */
    @Test
    void 지급은_가용_잔액을_묻지_않는다() {
        given(userRepository.existsById(USER_ID)).willReturn(true);
        given(catMoneyService.mint(eq(USER_ID), any(), any(), anyString()))
                .willReturn(transaction(CatTxReason.ADMIN_GRANT, 1_000));

        adminCatMoneyService.grant(ACTOR_ID, USER_ID, 1_000);

        verify(catMoneyHoldService, never()).availableBalance(anyLong());
    }

    /* ── 차감 ────────────────────────────────────────────────── */

    @Test
    void 차감은_가용_잔액_안이면_요청한_금액을_태운다() {
        given(userRepository.existsById(USER_ID)).willReturn(true);
        given(catMoneyHoldService.availableBalance(USER_ID)).willReturn(50_000L);
        given(catMoneyService.burn(eq(USER_ID), any(), eq(CatTxReason.ADMIN_BURN), anyString()))
                .willReturn(transaction(CatTxReason.ADMIN_BURN, 30_000));

        adminCatMoneyService.burn(ACTOR_ID, USER_ID, 30_000);

        assertThat(burnedAmount()).isEqualTo(BigInteger.valueOf(30_000));
    }

    /**
     * "0 으로 만들기" 가 이 기능의 주 용도다 — 넉넉한 수를 넣으면 남은 만큼만 빠져야 한다.
     *
     * <p>자르지 않고 그대로 보내면 체인이 거절해서 화면에는 이유 없는 실패로 보인다.
     */
    @Test
    void 차감은_가용_잔액보다_많이_요청하면_가용_잔액만큼만_태운다() {
        given(userRepository.existsById(USER_ID)).willReturn(true);
        given(catMoneyHoldService.availableBalance(USER_ID)).willReturn(30_000L);
        given(catMoneyService.burn(eq(USER_ID), any(), any(), anyString()))
                .willReturn(transaction(CatTxReason.ADMIN_BURN, 30_000));

        AdminCatMoneyAdjustResponse response =
                adminCatMoneyService.burn(ACTOR_ID, USER_ID, 999_999);

        assertThat(burnedAmount()).isEqualTo(BigInteger.valueOf(30_000));
        // 화면이 "요청한 만큼 다 빠지지 않았다" 를 말할 수 있어야 한다
        assertThat(response.requestedAmount()).isEqualTo(999_999);
        assertThat(response.appliedAmount()).isEqualTo(30_000);
    }

    /**
     * 🔴 기준이 체인 잔액이 아니라 <b>가용 잔액</b>이어야 한다.
     *
     * <p>입찰로 묶인 돈은 체인 잔액에 남아 있지만 임자가 있다. 체인 잔액을 기준으로 태우면
     * 그 돈까지 가져가 낙찰이 확정될 때 잔액이 모자라게 된다.
     */
    @Test
    void 차감은_묶인_돈까지_태우지_않는다() {
        given(userRepository.existsById(USER_ID)).willReturn(true);
        // 체인에는 50,000 이 있지만 40,000 이 입찰로 묶여 쓸 수 있는 건 10,000 뿐이다
        given(catMoneyHoldService.availableBalance(USER_ID)).willReturn(10_000L);
        given(catMoneyService.burn(eq(USER_ID), any(), any(), anyString()))
                .willReturn(transaction(CatTxReason.ADMIN_BURN, 10_000));

        adminCatMoneyService.burn(ACTOR_ID, USER_ID, 50_000);

        assertThat(burnedAmount()).isEqualTo(BigInteger.valueOf(10_000));
    }

    /** 0 을 태우는 요청은 체인도 원장 CHECK(amount > 0)도 거절한다. 가기 전에 막는다 */
    @Test
    void 차감은_가용_잔액이_없으면_거절한다() {
        given(userRepository.existsById(USER_ID)).willReturn(true);
        given(catMoneyHoldService.availableBalance(USER_ID)).willReturn(0L);

        assertThatThrownBy(() -> adminCatMoneyService.burn(ACTOR_ID, USER_ID, 10_000))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", WalletErrorCode.INSUFFICIENT_BALANCE);

        verify(catMoneyService, never()).burn(anyLong(), any(), any(), anyString());
    }

    /**
     * 가용 잔액이 음수로 나오는 경우 (판정 창구를 안 탄 지출이 있었을 때).
     *
     * <p>{@code Math.min} 만 썼다면 음수를 그대로 보내 CHECK 에 걸린다.
     */
    @Test
    void 차감은_가용_잔액이_음수여도_태우지_않는다() {
        given(userRepository.existsById(USER_ID)).willReturn(true);
        given(catMoneyHoldService.availableBalance(USER_ID)).willReturn(-5_000L);

        assertThatThrownBy(() -> adminCatMoneyService.burn(ACTOR_ID, USER_ID, 1_000))
                .isInstanceOf(BusinessException.class);

        verify(catMoneyService, never()).burn(anyLong(), any(), any(), anyString());
    }

    /* ── 대상 회원 ───────────────────────────────────────────── */

    @Test
    void 없는_회원에게는_발행하지_않는다() {
        given(userRepository.existsById(USER_ID)).willReturn(false);

        assertThatThrownBy(() -> adminCatMoneyService.grant(ACTOR_ID, USER_ID, 1_000))
                .isInstanceOf(BusinessException.class);

        verify(catMoneyService, never()).mint(anyLong(), any(), any(), anyString());
    }

    /* ── 멱등 키 ─────────────────────────────────────────────── */

    /**
     * 같은 금액을 두 번 넣는 것도 정상이라 키를 매번 새로 만든다.
     *
     * <p>고정 키였다면 두 번째 지급이 조용히 무시된다(ALREADY_DONE) — 관리자는 눌렀는데
     * 돈이 안 들어오는 것으로 보인다.
     */
    @Test
    void 같은_금액을_두_번_지급하면_멱등_키가_서로_다르다() {
        given(userRepository.existsById(USER_ID)).willReturn(true);
        given(catMoneyService.mint(eq(USER_ID), any(), any(), anyString()))
                .willReturn(transaction(CatTxReason.ADMIN_GRANT, 1_000));

        adminCatMoneyService.grant(ACTOR_ID, USER_ID, 1_000);
        adminCatMoneyService.grant(ACTOR_ID, USER_ID, 1_000);

        ArgumentCaptor<String> keys = ArgumentCaptor.forClass(String.class);
        verify(catMoneyService, org.mockito.Mockito.times(2))
                .mint(anyLong(), any(), any(), keys.capture());

        assertThat(keys.getAllValues()).doesNotHaveDuplicates();
        // 원장만 보고도 누가 누구에게 했는지 따라갈 수 있어야 한다
        assertThat(keys.getAllValues()).allSatisfy(key ->
                assertThat(key).startsWith("admin-grant:%d:%d:".formatted(ACTOR_ID, USER_ID)));
    }

    /* ── 도우미 ──────────────────────────────────────────────── */

    /** 체인에 실제로 보낸 금액 */
    private BigInteger burnedAmount() {
        ArgumentCaptor<BigInteger> amount = ArgumentCaptor.forClass(BigInteger.class);
        verify(catMoneyService).burn(anyLong(), amount.capture(), any(), anyString());
        return amount.getValue();
    }

    private CatTransaction transaction(CatTxReason reason, long amount) {
        return CatTransaction.sent(
                org.mockito.Mockito.mock(User.class),
                org.mockito.Mockito.mock(Wallet.class),
                reason,
                BigInteger.valueOf(amount),
                "key",
                "0x" + "1".repeat(64));
    }
}
