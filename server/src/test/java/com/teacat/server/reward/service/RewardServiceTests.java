package com.teacat.server.reward.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.reward.dto.response.DailyRewardStatusResponse;
import com.teacat.server.reward.dto.response.RewardClaimResponse;
import com.teacat.server.reward.entity.DailyReward;
import com.teacat.server.reward.entity.RewardType;
import com.teacat.server.reward.exception.RewardErrorCode;
import com.teacat.server.reward.repository.DailyRewardRepository;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.repository.UserRepository;

import com.teacat.server.wallet.entity.CatTransaction;
import com.teacat.server.wallet.entity.CatTxReason;
import com.teacat.server.wallet.entity.Wallet;
import com.teacat.server.wallet.service.CatMoneyService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigInteger;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

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
 * 하루 한 번 보상.
 *
 * <p>여기서 지키려는 것은 둘이다. <b>하루에 두 번 나가지 않는가</b>, 그리고 <b>못 줬는데
 * 받은 것으로 남지 않는가.</b> 앞을 놓치면 캣머니가 새고, 뒤를 놓치면 사용자가 그날 몫을
 * 통째로 잃는다.
 */
@ExtendWith(MockitoExtension.class)
class RewardServiceTests {

    private static final Long USER_ID = 42L;

    @Mock private DailyRewardRepository dailyRewardRepository;
    @Mock private UserRepository userRepository;
    @Mock private CatMoneyService catMoneyService;

    @InjectMocks private RewardService rewardService;

    /* ── 지급 ────────────────────────────────────────────────── */

    @Test
    void 출석_체크는_정해진_금액을_REWARD_사유로_발행한다() {
        givenFirstClaimToday();
        given(catMoneyService.mint(eq(USER_ID), any(), eq(CatTxReason.REWARD), anyString()))
                .willReturn(transaction(RewardType.ATTENDANCE.amount()));

        RewardClaimResponse response = rewardService.claim(USER_ID, RewardType.ATTENDANCE);

        assertThat(response.type()).isEqualTo(RewardType.ATTENDANCE);
        assertThat(response.amount()).isEqualTo(500);
        assertThat(mintedAmount()).isEqualTo(BigInteger.valueOf(500));
    }

    @Test
    void 송편_잡기는_출석보다_큰_금액을_발행한다() {
        givenFirstClaimToday();
        given(catMoneyService.mint(eq(USER_ID), any(), eq(CatTxReason.REWARD), anyString()))
                .willReturn(transaction(RewardType.SONGPYEON.amount()));

        RewardClaimResponse response = rewardService.claim(USER_ID, RewardType.SONGPYEON);

        assertThat(response.amount()).isEqualTo(1_000);
        assertThat(RewardType.SONGPYEON.amount()).isGreaterThan(RewardType.ATTENDANCE.amount());
    }

    /**
     * 멱등 키에 날짜가 들어 있어야 한다.
     *
     * <p>날짜가 빠지면 <b>내일 눌러도 어제 키</b>가 되어 체인이 조용히 무시한다(ALREADY_DONE) —
     * 기록만 쌓이고 돈은 안 들어온다. 반대로 매번 새 키를 만들면 재시도가 두 번 발행한다.
     */
    @Test
    void 멱등_키는_종류와_회원과_날짜로_고정된다() {
        givenFirstClaimToday();
        given(catMoneyService.mint(anyLong(), any(), any(), anyString()))
                .willReturn(transaction(500));

        rewardService.claim(USER_ID, RewardType.ATTENDANCE);

        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        verify(catMoneyService).mint(anyLong(), any(), any(), key.capture());
        assertThat(key.getValue())
                .isEqualTo("reward:attendance:%d:%s".formatted(USER_ID, LocalDate.now()));
    }

    /* ── 하루 한 번 ──────────────────────────────────────────── */

    @Test
    void 오늘_이미_받았으면_발행하지_않는다() {
        given(userRepository.existsById(USER_ID)).willReturn(true);
        given(dailyRewardRepository.findByUserIdAndRewardTypeAndRewardDate(
                eq(USER_ID), eq(RewardType.ATTENDANCE), any()))
                .willReturn(Optional.of(claimRow(RewardType.ATTENDANCE)));

        assertThatThrownBy(() -> rewardService.claim(USER_ID, RewardType.ATTENDANCE))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", RewardErrorCode.ALREADY_CLAIMED);

        verify(catMoneyService, never()).mint(anyLong(), any(), any(), anyString());
    }

    /**
     * 버튼을 빠르게 두 번 누르면 두 요청이 나란히 "아직 안 받았다" 를 읽는다.
     *
     * <p>조회만으로는 못 막고 UNIQUE 인덱스가 막는데, 그때 나오는 예외를 그대로 흘리면
     * 500 이 된다. 규칙 위반이므로 409 로 말해야 한다.
     */
    @Test
    void 동시에_두_번_눌러_UNIQUE_에_걸리면_이미_받음으로_말한다() {
        given(userRepository.existsById(USER_ID)).willReturn(true);
        given(dailyRewardRepository.findByUserIdAndRewardTypeAndRewardDate(anyLong(), any(), any()))
                .willReturn(Optional.empty());
        given(dailyRewardRepository.saveAndFlush(any()))
                .willThrow(new DataIntegrityViolationException("uq_daily_rewards_user_type_date"));

        assertThatThrownBy(() -> rewardService.claim(USER_ID, RewardType.ATTENDANCE))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", RewardErrorCode.ALREADY_CLAIMED);

        verify(catMoneyService, never()).mint(anyLong(), any(), any(), anyString());
    }

    /* ── 발행이 실패했을 때 ──────────────────────────────────── */

    /**
     * 🔴 못 줬으면 "오늘 받음" 도 남으면 안 된다.
     *
     * <p>선점 행을 지우지 않으면 체인이 잠깐 흔들린 날 사용자는 하루치를 통째로 잃는다 —
     * 다시 눌러도 409 라 스스로 복구할 방법이 없다.
     */
    @Test
    void 발행에_실패하면_오늘_기록을_되돌린다() {
        DailyReward claim = claimRow(RewardType.SONGPYEON);
        given(userRepository.existsById(USER_ID)).willReturn(true);
        given(dailyRewardRepository.findByUserIdAndRewardTypeAndRewardDate(anyLong(), any(), any()))
                .willReturn(Optional.empty());
        given(dailyRewardRepository.saveAndFlush(any())).willReturn(claim);
        given(catMoneyService.mint(anyLong(), any(), any(), anyString()))
                .willThrow(new IllegalStateException("체인 응답 없음"));

        assertThatThrownBy(() -> rewardService.claim(USER_ID, RewardType.SONGPYEON))
                .isInstanceOf(IllegalStateException.class);

        verify(dailyRewardRepository).delete(claim);
    }

    /* ── 현황 ────────────────────────────────────────────────── */

    /**
     * 안 받은 종류도 내려줘야 한다.
     *
     * <p>받은 것만 내려주면 화면이 "없는 것 = 안 받음" 을 추론해야 하고, 종류가 늘 때
     * 조용히 빠진다.
     */
    @Test
    void 현황은_받지_않은_종류도_함께_내려준다() {
        given(dailyRewardRepository.findByUserIdAndRewardDate(eq(USER_ID), any()))
                .willReturn(List.of(claimRow(RewardType.ATTENDANCE)));

        DailyRewardStatusResponse status = rewardService.status(USER_ID);

        assertThat(status.rewards()).hasSize(RewardType.values().length);
        assertThat(status.rewards())
                .filteredOn(reward -> reward.type() == RewardType.ATTENDANCE)
                .singleElement()
                .satisfies(reward -> assertThat(reward.claimed()).isTrue());
        assertThat(status.rewards())
                .filteredOn(reward -> reward.type() == RewardType.SONGPYEON)
                .singleElement()
                .satisfies(reward -> {
                    assertThat(reward.claimed()).isFalse();
                    // 금액은 안 받았어도 알려줘야 화면이 "얼마 받는지" 를 적지 않는다
                    assertThat(reward.amount()).isEqualTo(RewardType.SONGPYEON.amount());
                });
    }

    /* ── 도우미 ──────────────────────────────────────────────── */

    private void givenFirstClaimToday() {
        given(userRepository.existsById(USER_ID)).willReturn(true);
        given(dailyRewardRepository.findByUserIdAndRewardTypeAndRewardDate(anyLong(), any(), any()))
                .willReturn(Optional.empty());
        given(dailyRewardRepository.saveAndFlush(any()))
                .willAnswer(invocation -> invocation.getArgument(0));
    }

    private BigInteger mintedAmount() {
        ArgumentCaptor<BigInteger> amount = ArgumentCaptor.forClass(BigInteger.class);
        verify(catMoneyService).mint(anyLong(), amount.capture(), any(), anyString());
        return amount.getValue();
    }

    private DailyReward claimRow(RewardType type) {
        return DailyReward.claim(USER_ID, type, LocalDate.now());
    }

    private CatTransaction transaction(long amount) {
        return CatTransaction.sent(
                Mockito.mock(User.class),
                Mockito.mock(Wallet.class),
                CatTxReason.REWARD,
                BigInteger.valueOf(amount),
                "key",
                "0x" + "1".repeat(64));
    }
}
