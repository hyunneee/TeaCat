package com.teacat.server.wallet.messaging;

import com.teacat.server.common.config.RabbitConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 지갑 발급 메시지 발행.
 *
 * <p>발행 실패는 <b>예외로 올리지 않는다.</b> 가입은 이미 커밋됐고, PENDING 행이 남아 있으므로
 * 스위퍼가 다시 보낸다. 여기서 던지면 사용자는 "가입 실패" 를 보는데 실제로는 가입돼 있다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WalletProvisionPublisher {

    private final RabbitTemplate rabbitTemplate;

    /** 가입 트랜잭션이 커밋된 뒤에만 불린다. 롤백되면 불리지 않는다 */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onRequested(WalletProvisionRequestedEvent event) {
        publish(event.provisionId());
    }

    /** @return 브로커가 메시지를 받았으면 true */
    public boolean publish(Long provisionId) {
        try {
            rabbitTemplate.convertAndSend(
                    RabbitConfig.WALLET_EXCHANGE,
                    RabbitConfig.WALLET_PROVISION_ROUTING_KEY,
                    new WalletProvisionMessage(provisionId));
            return true;
        } catch (AmqpException e) {
            log.warn("지갑 발급 메시지를 보내지 못했습니다. 스위퍼가 다시 보냅니다. provisionId={}", provisionId, e);
            return false;
        }
    }
}
