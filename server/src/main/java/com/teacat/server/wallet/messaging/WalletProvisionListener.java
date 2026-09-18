package com.teacat.server.wallet.messaging;

import com.teacat.server.common.config.RabbitConfig;
import com.teacat.server.wallet.service.WalletProvisioner;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

/**
 * 지갑 발급 메시지 소비자.
 *
 * <p>실패하면 <b>재큐잉하지 않고</b> DLQ 로 보낸다. 재큐잉하면 블록체인 서비스가 죽어 있는 동안
 * 같은 메시지가 즉시 되돌아와 초당 수십 번 돌며 다른 메시지까지 막는다.
 * 다시 시도할 때는 스위퍼가 정한다 (wallet.provisioning.retry-after).
 *
 * <p>두 인스턴스(블루·그린)가 같은 메시지를 동시에 집어도 {@link WalletProvisioner} 가 행을 잠그고
 * DONE 을 확인하므로 지갑이 둘 생기지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WalletProvisionListener {

    private final WalletProvisioner walletProvisioner;

    @RabbitListener(queues = RabbitConfig.WALLET_PROVISION_QUEUE)
    public void handle(WalletProvisionMessage message) {
        try {
            walletProvisioner.provision(message.provisionId());
        } catch (RuntimeException e) {
            log.warn("지갑 발급에 실패해 DLQ 로 보냅니다. 스위퍼가 다시 시도합니다. provisionId={}",
                    message.provisionId(), e);
            throw new AmqpRejectAndDontRequeueException("wallet provision failed: " + message.provisionId(), e);
        }
    }
}
