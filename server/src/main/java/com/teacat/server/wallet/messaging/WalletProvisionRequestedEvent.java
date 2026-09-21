package com.teacat.server.wallet.messaging;

/**
 * 가입 트랜잭션 안에서 발행되는 스프링 이벤트. {@link WalletProvisionPublisher} 가 <b>커밋 뒤에</b> 받아 큐로 보낸다.
 *
 * <p>가입 트랜잭션 안에서 RabbitTemplate 을 직접 부르면 안 된다. 롤백된 회원의 메시지가 큐에 남아
 * 없는 회원에게 지갑을 만들고 1,500 CAT 을 주인 없이 보낸다.
 */
public record WalletProvisionRequestedEvent(Long provisionId) {
}
