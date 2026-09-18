package com.teacat.server.queue.service;

import com.teacat.server.common.config.QueueProperties;
import com.teacat.server.queue.repository.QueueRedisRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 입장 관리자. 1초마다 깨어나 정원에 빈자리가 있는 회차마다 대기열 앞사람을 들여보낸다.
 *
 * <p>🔴 {@code SchedulingConfig} 는 "인스턴스가 하나" 라는 전제인데, 운영은 블루/그린이라 전환 중에는
 * 두 대가 함께 돈다. 락 없이 둘이 같이 돌면 정원을 두 배로 들여보낸다. 그래서 매 틱 Redis 락을 잡은 쪽만 돈다.
 * 락은 풀지 않고 TTL(주기의 두 배)로 흘려보낸다 — 잡은 쪽이 죽어도 다음다음 틱에는 다른 쪽이 잡는다.
 *
 * <p>정원·틱 상한·TTL 은 환경변수({@link QueueProperties})를 Lua 의 ARGV 로 넘긴다. 회차별 override 가
 * Redis config 에 있으면 Lua 안에서 그 값이 우선한다. 여기서는 계산하지 않는다.
 *
 * <p>활성 회차가 하나도 없으면 한 틱의 Redis 호출은 락 1회 + SMEMBERS 1회다. 대기실을 안 쓰는 평소 비용이다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class QueueAdmitter {

    private final QueueRedisRepository repository;
    private final QueueProperties properties;
    private final QueueMetrics metrics;

    @Scheduled(fixedDelayString = "${queue.admit-interval}")
    public void tick() {
        if (!properties.admitterEnabled()) {
            return;
        }
        runOnce();
    }

    /** 한 틱. 테스트가 스케줄러를 끄고 직접 부른다 */
    public void runOnce() {
        if (!repository.tryLock(properties.lockTtl())) {
            metrics.lockSkipped();
            return;
        }
        long now = System.currentTimeMillis();
        for (Long scheduleId : repository.enabledScheduleIds()) {
            try {
                List<Long> admitted = repository.admit(scheduleId, now,
                        properties.capacity(), properties.maxPerTick(), properties.ttlSeconds());
                if (!admitted.isEmpty()) {
                    repository.recordAdmits(scheduleId, admitted.size(), now);
                    metrics.admitted(scheduleId, admitted.size());
                }
                metrics.updateGauges(scheduleId,
                        repository.waitingCount(scheduleId), repository.admittedCount(scheduleId, now));
            } catch (RuntimeException e) {
                // 한 회차가 실패해도 다른 회차 입장은 계속돼야 한다
                log.error("대기실 입장 처리 실패 scheduleId={}", scheduleId, e);
            }
        }
    }
}
