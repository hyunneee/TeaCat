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
 * <p>판돈을 목록으로 받는 이유는 자유 입력이면 1 캣머니짜리 판으로 보조금만 긁어갈 수
 * 있기 때문이다. 0 은 연습 모드다.
 *
 * @param betChoices        고를 수 있는 판돈. 0(연습)을 포함한다
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
        return betChoices != null && betChoices.contains(amount);
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
