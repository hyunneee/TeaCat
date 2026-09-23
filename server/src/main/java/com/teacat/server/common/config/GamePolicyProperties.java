package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.List;

/**
 * application.yaml 의 game.* 설정 — 같이 하는 게임(윷놀이·할리갈리)의 돈 규칙.
 *
 * <p>🔴 <b>보조금은 우리가 새로 찍어내는 돈이다.</b> 판마다 인원수 × {@code subsidyPerPlayer}
 * 만큼 총량이 는다. 그래서 한도 없이 두면 계정 두 개로 판을 계속 돌리는 것만으로 캣머니가
 * 무한히 생긴다. {@code subsidyDailyCap} 이 그것을 막는다 — 한도를 넘으면 판은 그대로
 * 돌아가고 보조금만 깎인다(참가자들이 낸 판돈은 온전히 나뉜다).
 *
 * <p>🔴 <b>판돈은 자유 입력이다.</b> {@code betChoices} 는 이제 화면의 빠른 선택일 뿐이고,
 * 실제로 허용하는 범위는 0 부터 목록의 최댓값까지다. 예전에는 목록에 있는 값만 받았는데,
 * 그 이유는 <b>1 캣머니짜리 판으로 보조금만 긁어가는 것</b>을 막기 위해서였다.
 * 자유 입력으로 열면서 그 방어는 {@link #subsidyMinBet()} 으로 옮겼다 — 판돈이
 * 너무 적은 판에는 보조금을 얹지 않는다. 판은 그대로 돌아가고 보조금만 빠진다.
 *
 * @param betChoices        화면에 띄울 빠른 선택 금액. 0(연습)을 포함하고, 최댓값이 곧 상한이다
 * @param subsidyPerPlayer  판마다 참가자 한 명당 얹어주는 금액
 * @param subsidyDailyCap   한 사람이 하루에 받을 수 있는 보조금 총액
 * @param prizeShares       인원수별 등수 배분 비율(%). 인덱스 = 인원수 − 1
 * @param turnSweepInterval 멈춘 판을 훑는 주기
 * @param abandonAfter      아무도 안 온 대기방을 닫기까지
 */
@ConfigurationProperties(prefix = "game")
public record GamePolicyProperties(
        List<Long> betChoices,
        long subsidyPerPlayer,
        long subsidyDailyCap,
        List<List<Integer>> prizeShares,
        Duration turnSweepInterval,
        Duration abandonAfter) {

    public boolean allowsBet(long amount) {
        return amount >= 0 && amount <= maxBet();
    }

    /** 걸 수 있는 최대 금액 — 빠른 선택의 가장 큰 값. 목록이 비면 아무것도 못 건다 */
    public long maxBet() {
        return betChoices == null ? 0 : betChoices.stream().mapToLong(Long::longValue).max().orElse(0);
    }

    /**
     * 보조금을 받으려면 최소 이만큼은 걸어야 한다 — 빠른 선택의 가장 작은 <b>0 아닌</b> 값.
     *
     * <p>🔴 설정을 새로 만들지 않고 목록에서 끌어낸다. 값이 두 군데 있으면 한쪽만 바꿔서
     * 방어가 조용히 풀린다. 목록에 0 말고 아무것도 없으면 보조금이 아예 나가지 않는다.
     */
    public long subsidyMinBet() {
        return betChoices == null ? Long.MAX_VALUE
                : betChoices.stream().mapToLong(Long::longValue).filter(v -> v > 0).min().orElse(Long.MAX_VALUE);
    }

    /**
     * 인원수에 맞는 등수별 비율.
     *
     * @return 앞에서부터 1등, 2등 … 의 퍼센트. 합이 100 이 아니면 나머지는 1등에게 간다
     */
    public List<Integer> sharesFor(int players) {
        if (prizeShares == null || players < 1 || players > prizeShares.size()) {
            return List.of(100);
        }
        return prizeShares.get(players - 1);
    }
}
