package com.teacat.server.queue.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.teacat.server.common.config.QueueProperties;
import com.teacat.server.queue.repository.QueueRedisRepository;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * 좌석·선점 API 앞에서 인터셉터가 부르는 판정.
 *
 * <p>요청마다 Redis 를 두 번 가지 않도록 "이 회차가 대기실을 켰는가" 는 <b>1초 로컬 캐시</b>다.
 * 관리자가 켜고 끈 값이 최대 1초 늦게 반영되는 건 허용한다. 대기실이 꺼진 회차(기본 상태)는
 * 이 캐시 한 번으로 끝나서 기존 동작에 비용을 거의 더하지 않는다.
 *
 * <p>입장 표식 확인은 캐시하지 않는다. 표식은 사용자별이고, 확인과 동시에 만료를 연장해야 한다.
 */
@Component
public class QueueAdmissionChecker {

    private final QueueRedisRepository repository;
    private final QueueProperties properties;
    private final Cache<Long, Boolean> enabledCache = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofSeconds(1))
            .maximumSize(1_000)
            .build();

    public QueueAdmissionChecker(QueueRedisRepository repository, QueueProperties properties) {
        this.repository = repository;
        this.properties = properties;
    }

    public boolean isEnabled(Long scheduleId) {
        return Boolean.TRUE.equals(enabledCache.get(scheduleId, repository::isEnabled));
    }

    /**
     * 관리자가 이 인스턴스에서 켜고 끈 직후 부른다. 같은 인스턴스는 1초를 기다리지 않고 바로 반영된다.
     * (블루/그린의 다른 인스턴스는 캐시 만료(1초)를 기다린다 — 그 정도 지연은 허용한다)
     */
    public void invalidate(Long scheduleId) {
        enabledCache.invalidate(scheduleId);
    }

    /** 테스트가 Redis 를 직접 비운 뒤 캐시가 옛 값을 들고 있지 않게 */
    public void invalidateAll() {
        enabledCache.invalidateAll();
    }

    /**
     * 입장 표식이 유효하면 만료를 연장하고 true. 없거나 만료됐으면 false.
     *
     * <p>폴링이 3초 주기라 매 요청 연장은 Redis 쓰기 1회다. 부담이 되면 "남은 시간이 절반 미만일 때만 연장" 으로 줄인다.
     */
    public boolean checkAndTouch(Long scheduleId, Long userId) {
        long now = System.currentTimeMillis();
        if (!repository.isAdmitted(scheduleId, userId, now)) {
            return false;
        }
        repository.touch(scheduleId, userId, now + properties.ttl().toMillis());
        return true;
    }
}
