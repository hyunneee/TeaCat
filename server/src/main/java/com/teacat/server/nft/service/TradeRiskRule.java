package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftTradeReviewProperties;
import com.teacat.server.nft.entity.NftTradeRiskSignal;

import java.util.List;

/**
 * 이상거래 규칙 하나. 맥락을 읽고 신호를 0개 이상 돌려준다. 조회하지 않고, 상태를 갖지 않는다.
 *
 * <p>규칙 코드({@link #code()})는 심사 행의 signals 와 통계·화면이 그대로 쓰므로 한 번 나가면 바꾸지 않는다.
 * 신호의 evidence 에는 숫자·불리언·내부 id 만 넣는다 — AI 프롬프트와 관리자 화면으로 그대로 간다.
 */
public interface TradeRiskRule {

    String code();

    List<NftTradeRiskSignal> evaluate(TradeRiskContext context, NftTradeReviewProperties properties);
}
