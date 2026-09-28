package com.teacat.server.common.config;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 판돈 규칙.
 *
 * <p>판돈을 자유 입력으로 열면서 "1 캣머니짜리 판으로 보조금만 긁어간다" 를 막던 장치가
 * 목록 검사에서 {@link GamePolicyProperties#subsidyMinBet()} 으로 옮겨 갔다. 두 값 모두
 * 같은 목록에서 끌어내므로, 목록을 바꿨을 때 어느 한쪽만 따라오지 않는지 여기서 지킨다.
 */
class GamePolicyPropertiesTests {

    private final GamePolicyProperties policy = new GamePolicyProperties(
            List.of(0L, 100L, 500L, 1000L), 100, 1000,
            List.of(List.of(100)), Duration.ofSeconds(10), Duration.ofMinutes(30));

    @Test
    void 목록에_없는_금액도_상한_안이면_받는다() {
        assertThat(policy.allowsBet(0)).isTrue();
        assertThat(policy.allowsBet(1)).isTrue();
        assertThat(policy.allowsBet(777)).isTrue();
        assertThat(policy.allowsBet(1000)).isTrue();
    }

    @Test
    void 상한을_넘거나_음수면_막는다() {
        assertThat(policy.allowsBet(1001)).isFalse();
        assertThat(policy.allowsBet(-1)).isFalse();
    }

    @Test
    void 보조금_하한은_목록의_가장_작은_0_아닌_값이다() {
        assertThat(policy.subsidyMinBet()).isEqualTo(100);
    }

    @Test
    void 연습만_있는_목록이면_보조금이_아예_나가지_않는다() {
        GamePolicyProperties practiceOnly = new GamePolicyProperties(
                List.of(0L), 100, 1000, List.of(List.of(100)),
                Duration.ofSeconds(10), Duration.ofMinutes(30));

        // 어떤 판돈도 하한을 넘지 못하므로 grantableSubsidy 가 늘 0 이 된다
        assertThat(practiceOnly.subsidyMinBet()).isEqualTo(Long.MAX_VALUE);
        assertThat(practiceOnly.maxBet()).isZero();
    }
}
