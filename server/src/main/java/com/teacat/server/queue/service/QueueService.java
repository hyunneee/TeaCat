package com.teacat.server.queue.service;

import com.teacat.server.common.config.QueueProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.queue.dto.request.QueueConfigRequest;
import com.teacat.server.queue.dto.response.QueueAdminStatusResponse;
import com.teacat.server.queue.dto.response.QueueStatusResponse;
import com.teacat.server.queue.exception.QueueErrorCode;
import com.teacat.server.queue.repository.QueueRedisRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * 가상 대기실 — 진입 · 상태 · 이탈 · 관리자 설정.
 *
 * <p>DB 는 회차 존재 확인(진입 때 한 번)에만 간다. 상태 조회는 Redis 조회 두어 번으로 끝나서
 * 대기 인원 2만 명이 5초마다 물어봐도 서버 부담이 거의 없다 — 그게 대기실이 존재하는 이유다.
 *
 * <p>이 도메인은 다른 도메인을 모른다. 좌석·선점·결제 쪽도 이 도메인을 모르고,
 * {@code QueueAdmissionInterceptor} 가 밖에서 문을 지킨다.
 */
@Service
@RequiredArgsConstructor
public class QueueService {

    /** 대기 인원이 이보다 많으면 폴링 주기를 늘려 달라고 프론트에 알린다 */
    private static final int LONG_QUEUE_THRESHOLD = 10_000;

    private final QueueRedisRepository repository;
    private final PerformanceDetailRepository performanceDetailRepository;
    private final QueueProperties properties;
    private final QueueAdmissionChecker admissionChecker;

    /**
     * 대기열에 선다. 이미 서 있으면 순번을 유지하고(새로고침 안전), 이미 입장 상태면 그대로 입장 상태를 돌려준다.
     */
    public QueueStatusResponse enter(Long scheduleId, Long userId) {
        if (!performanceDetailRepository.existsById(scheduleId)) {
            throw new BusinessException(QueueErrorCode.SCHEDULE_NOT_FOUND);
        }
        if (!repository.isEnabled(scheduleId)) {
            throw new BusinessException(QueueErrorCode.QUEUE_DISABLED);
        }
        long now = System.currentTimeMillis();
        if (!repository.isAdmitted(scheduleId, userId, now)) {
            repository.enter(scheduleId, userId, now);
        }
        return status(scheduleId, userId);
    }

    /**
     * 내 상태. 대기실 화면이 {@code pollAfterSec} 주기로 부른다.
     *
     * <p>대기열에도 입장 표식에도 없는 사용자(입장 후 10분 무활동으로 빠진 뒤 돌아온 경우 등)는
     * 다시 줄 뒤에 세운다. GET 에 쓰기가 섞이지만, 그 사용자가 다음에 할 일은 어차피 enter 다.
     */
    public QueueStatusResponse status(Long scheduleId, Long userId) {
        int capacity = effectiveCapacity(scheduleId);
        if (!repository.isEnabled(scheduleId)) {
            return QueueStatusResponse.disabled(scheduleId, capacity);
        }
        long now = System.currentTimeMillis();
        if (repository.isAdmitted(scheduleId, userId, now)) {
            return QueueStatusResponse.admitted(scheduleId, capacity);
        }
        Optional<Long> rank = repository.rank(scheduleId, userId);
        if (rank.isEmpty()) {
            repository.enter(scheduleId, userId, now);
            rank = repository.rank(scheduleId, userId);
        }
        long ahead = rank.orElse(0L);
        Integer estimatedWaitSec = estimateWaitSec(scheduleId, ahead, now);
        int pollAfterSec = ahead > LONG_QUEUE_THRESHOLD ? 10 : 5;
        return new QueueStatusResponse(scheduleId, true, false,
                (int) ahead + 1, (int) ahead, estimatedWaitSec, capacity, pollAfterSec);
    }

    /** 대기열과 입장 표식에서 빠진다. 결제 완료 · 뒤로가기 · 탭 닫기. 실패해도 TTL 이 뒤처리한다 */
    public void leave(Long scheduleId, Long userId) {
        repository.leave(scheduleId, userId);
    }

    // ── 관리자 ─────────────────────────────────────────────────

    public QueueAdminStatusResponse adminStatus(Long scheduleId) {
        long now = System.currentTimeMillis();
        Integer capacityOverride = repository.override(scheduleId, QueueRedisRepository.FIELD_CAPACITY).orElse(null);
        Integer maxPerTickOverride = repository.override(scheduleId, QueueRedisRepository.FIELD_MAX_PER_TICK).orElse(null);
        Integer ttlSecOverride = repository.override(scheduleId, QueueRedisRepository.FIELD_TTL_SEC).orElse(null);
        return new QueueAdminStatusResponse(
                scheduleId,
                repository.isEnabled(scheduleId),
                repository.waitingCount(scheduleId),
                repository.admittedCount(scheduleId, now),
                capacityOverride != null ? capacityOverride : properties.capacity(),
                capacityOverride,
                maxPerTickOverride != null ? maxPerTickOverride : properties.maxPerTick(),
                maxPerTickOverride,
                ttlSecOverride != null ? ttlSecOverride : (int) properties.ttlSeconds(),
                ttlSecOverride,
                repository.admitsLast60s(scheduleId, now) / 60.0);
    }

    /**
     * 켜기/끄기와 회차별 override. Bean Validation 이 양수 검사를 하고, 여기서는 값끼리의 관계만 본다.
     */
    public QueueAdminStatusResponse updateConfig(Long scheduleId, QueueConfigRequest request) {
        if (!performanceDetailRepository.existsById(scheduleId)) {
            throw new BusinessException(QueueErrorCode.SCHEDULE_NOT_FOUND);
        }
        int capacity = request.capacity() != null ? request.capacity() : properties.capacity();
        int maxPerTick = request.maxPerTick() != null ? request.maxPerTick() : properties.maxPerTick();
        if (maxPerTick > capacity) {
            // 한 틱에 정원보다 많이 들여보내라는 설정은 뜻이 없다. 잘못 입력한 것이다
            throw new BusinessException(QueueErrorCode.INVALID_CONFIG);
        }
        repository.setOverride(scheduleId, QueueRedisRepository.FIELD_CAPACITY, request.capacity());
        repository.setOverride(scheduleId, QueueRedisRepository.FIELD_MAX_PER_TICK, request.maxPerTick());
        repository.setOverride(scheduleId, QueueRedisRepository.FIELD_TTL_SEC, request.ttlSec());
        repository.setEnabled(scheduleId, request.enabled());
        // 인터셉터의 1초 로컬 캐시를 비워 이 인스턴스에서는 바로 반영되게 한다
        admissionChecker.invalidate(scheduleId);
        return adminStatus(scheduleId);
    }

    /** 회차 종료 후 정리. 대기 중이던 사용자는 다음 status 에서 다시 줄을 서게 되므로 끝난 회차에만 쓴다 */
    public void reset(Long scheduleId) {
        repository.clear(scheduleId, System.currentTimeMillis());
        admissionChecker.invalidate(scheduleId);
    }

    // ── 내부 ──────────────────────────────────────────────────

    private int effectiveCapacity(Long scheduleId) {
        return repository.override(scheduleId, QueueRedisRepository.FIELD_CAPACITY).orElse(properties.capacity());
    }

    /**
     * 앞사람 수 ÷ 최근 60초 평균 입장 속도. 최근에 아무도 입장하지 않았으면(속도 0) 모른다고 답한다.
     * 단 앞사람이 없으면 속도와 무관하게 다음 차례다 — 0 을 준다("곧 입장").
     */
    private Integer estimateWaitSec(Long scheduleId, long ahead, long nowMs) {
        if (ahead == 0) {
            return 0;
        }
        double perSec = repository.admitsLast60s(scheduleId, nowMs) / 60.0;
        if (perSec <= 0) {
            return null;
        }
        return (int) Math.ceil(ahead / perSec);
    }
}
