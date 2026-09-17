package com.teacat.server.queue.service;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 가상 대기실 지표 (Prometheus 가 15초마다 긁는다).
 *
 * <pre>
 *   teacat.queue.waiting{schedule}         gauge    대기 인원
 *   teacat.queue.admitted{schedule}        gauge    입장 인원 (정원과 비교)
 *   teacat.queue.admit.total{schedule}     counter  입장 수 → 입장 속도
 *   teacat.queue.rejected.total{schedule}  counter  428 수. 우회 시도·프론트 버그 탐지
 *   teacat.queue.admitter.lock.skipped     counter  락 경쟁으로 건너뛴 틱. 블루/그린 전환 중 정상 증가
 * </pre>
 *
 * 게이지는 회차별로 처음 볼 때 등록한다. 회차 수는 많지 않아 등록 수가 문제되지 않는다.
 */
@Component
public class QueueMetrics {

    private final MeterRegistry registry;
    private final Map<Long, AtomicLong> waiting = new ConcurrentHashMap<>();
    private final Map<Long, AtomicLong> admitted = new ConcurrentHashMap<>();
    private final Counter lockSkipped;

    public QueueMetrics(MeterRegistry registry) {
        this.registry = registry;
        this.lockSkipped = Counter.builder("teacat.queue.admitter.lock.skipped")
                .description("락 경쟁으로 건너뛴 입장 관리자 틱")
                .register(registry);
    }

    public void admitted(Long scheduleId, int count) {
        Counter.builder("teacat.queue.admit")
                .description("대기실 입장 수")
                .tag("schedule", String.valueOf(scheduleId))
                .register(registry)
                .increment(count);
    }

    public void rejected(Long scheduleId) {
        Counter.builder("teacat.queue.rejected")
                .description("입장 표식 없이 좌석·선점 API 를 부른 수 (428)")
                .tag("schedule", String.valueOf(scheduleId))
                .register(registry)
                .increment();
    }

    public void lockSkipped() {
        lockSkipped.increment();
    }

    public void updateGauges(Long scheduleId, long waitingCount, long admittedCount) {
        holder(waiting, scheduleId, "teacat.queue.waiting", "대기실 대기 인원").set(waitingCount);
        holder(admitted, scheduleId, "teacat.queue.admitted", "좌석 페이지 입장 인원").set(admittedCount);
    }

    private AtomicLong holder(Map<Long, AtomicLong> holders, Long scheduleId, String name, String description) {
        return holders.computeIfAbsent(scheduleId, sid -> {
            AtomicLong value = new AtomicLong();
            Gauge.builder(name, value, AtomicLong::get)
                    .description(description)
                    .tag("schedule", String.valueOf(sid))
                    .register(registry);
            return value;
        });
    }
}
