package com.teacat.server.nft.entity;

import java.util.Map;

/**
 * 이상거래 규칙 하나가 낸 신호. 심사 행의 signals(jsonb) 배열 원소이고, 관리자 화면과 AI 보고서 입력이 그대로 읽는다.
 *
 * @param rule     규칙 코드 (R1_SAME_DEVICE …). 설정·화면·통계가 이 문자열로 분기하므로 바꾸지 않는다
 * @param severity 무게
 * @param evidence 근거. <b>숫자·불리언·내부 id 만</b> 넣는다 — 이메일·전화·닉네임·IP 원문은 넣지 않는다 (AI 프롬프트로 간다)
 */
public record NftTradeRiskSignal(String rule, NftReviewSeverity severity, Map<String, Object> evidence) {
}
