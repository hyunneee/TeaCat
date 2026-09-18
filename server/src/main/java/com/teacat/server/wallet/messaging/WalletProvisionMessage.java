package com.teacat.server.wallet.messaging;

/**
 * 큐에 실리는 메시지. "이 발급 요청 행을 지금 처리해라" 는 신호이고, 그 이상은 담지 않는다.
 *
 * <p>회원 정보나 금액을 여기 실으면 진실이 두 곳(DB 행·메시지)으로 갈라진다.
 * 소비자는 id 로 행을 다시 읽는다.
 */
public record WalletProvisionMessage(Long provisionId) {
}
