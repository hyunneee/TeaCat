package com.teacat.server.common.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ 토폴로지.
 *
 * <p>큐는 <b>"이 DB 행을 지금 처리해라"는 신호</b>로만 쓴다. 진실은 항상 DB 행에 있다.
 * 메시지가 사라져도 스위퍼가 DB 를 훑어 다시 보내므로, 여기서는 지속성(durable)만 지키면 된다.
 *
 * <p>처리에 실패한 메시지는 재큐잉하지 않고 DLQ 로 보낸다. 재큐잉하면 블록체인 서비스가
 * 죽어 있는 동안 같은 메시지가 초당 수십 번 돌며 로그를 채운다. 재시도 간격은 스위퍼가 정한다.
 */
@Configuration
public class RabbitConfig {

    public static final String WALLET_EXCHANGE = "teacat.wallet";
    public static final String WALLET_PROVISION_QUEUE = "wallet.provision";
    public static final String WALLET_PROVISION_DLQ = "wallet.provision.dlq";
    public static final String WALLET_PROVISION_ROUTING_KEY = "wallet.provision";

    @Bean
    public MessageConverter messageConverter() {
        return new JacksonJsonMessageConverter();
    }

    @Bean
    public DirectExchange walletExchange() {
        return new DirectExchange(WALLET_EXCHANGE, true, false);
    }

    @Bean
    public Queue walletProvisionQueue() {
        return QueueBuilder.durable(WALLET_PROVISION_QUEUE)
                .deadLetterExchange(WALLET_EXCHANGE)
                .deadLetterRoutingKey(WALLET_PROVISION_DLQ)
                .build();
    }

    @Bean
    public Queue walletProvisionDlq() {
        return QueueBuilder.durable(WALLET_PROVISION_DLQ).build();
    }

    @Bean
    public Binding walletProvisionBinding() {
        return BindingBuilder.bind(walletProvisionQueue()).to(walletExchange()).with(WALLET_PROVISION_ROUTING_KEY);
    }

    @Bean
    public Binding walletProvisionDlqBinding() {
        return BindingBuilder.bind(walletProvisionDlq()).to(walletExchange()).with(WALLET_PROVISION_DLQ);
    }
}
