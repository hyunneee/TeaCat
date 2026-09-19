package com.teacat.server.auth.service;

import com.teacat.server.auth.entity.UserLoginEvent;
import com.teacat.server.auth.repository.UserLoginEventRepository;
import com.teacat.server.auth.security.ClientRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;

/**
 * 로그인 성공 시 단말 기록을 한 행 남긴다 (이상거래 심사 R8 용).
 *
 * <p><b>기록이 실패해도 로그인은 성공해야 한다.</b> 그래서 호출자 트랜잭션에 합류하지 않고 별도 트랜잭션
 * ({@code REQUIRES_NEW})으로 저장하며, 실패는 여기서 삼킨다 — 호출자 트랜잭션이 rollback-only 로 더럽혀지지 않는다.
 * 로그에는 userId 만 남긴다. IP·UA 는 개인정보다.
 */
@Slf4j
@Component
public class LoginEventRecorder {

    private final UserLoginEventRepository repository;
    private final TransactionTemplate newTransaction;

    public LoginEventRecorder(UserLoginEventRepository repository, PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.newTransaction = new TransactionTemplate(transactionManager);
        this.newTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void record(Long userId, ClientRequest client) {
        UserLoginEvent event = UserLoginEvent.of(userId, client);
        if (event == null) {
            return;
        }
        try {
            newTransaction.executeWithoutResult(tx -> repository.save(event));
        } catch (RuntimeException e) {
            log.warn("로그인 단말 기록 실패 userId={}", userId, e);
        }
    }

    @Transactional
    public int deleteOlderThan(LocalDateTime before) {
        return repository.deleteCreatedBefore(before);
    }
}
