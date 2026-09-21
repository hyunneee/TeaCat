package com.teacat.server.queue.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 가상 대기실 저장소 (Redis). 키 설계는 server/QUEUE_DESIGN.md 4장.
 *
 * <pre>
 *   queue:{sid}:waiting     ZSET  member=userId  score=진입 시각(ms)   앞사람 = 점수 작은 사람
 *   queue:{sid}:admitted    ZSET  member=userId  score=만료 시각(ms)   유효 입장자 = ZCOUNT now +inf
 *   queue:{sid}:config      HASH  enabled(0/1) · capacity · maxPerTick · ttlSec (뒤 셋은 override 일 때만)
 *   queue:{sid}:rate:{b}    STR   10초 버킷별 입장 수. 예상 대기 시간 계산용
 *   queue:enabled           SET   대기실이 켜진 scheduleId. 입장 관리자가 SCAN 없이 돌 회차를 안다
 *   queue:admitter:lock     STR   입장 관리자 락 (SET NX EX)
 * </pre>
 *
 * <p><b>입장자를 TTL 키가 아니라 만료 시각 점수의 ZSET 에 두는 이유.</b>
 * 사용자별 키 + TTL 은 "지금 몇 명 들어가 있나" 를 세려면 SCAN 이거나 카운터 보정이 필요하다.
 * 점수를 만료 시각으로 두면 {@code ZCOUNT now +inf} 한 번이 정원 계산이고,
 * 만료자 정리는 {@code ZREMRANGEBYSCORE -inf now} 한 줄이다. 어긋날 카운터가 없다.
 *
 * <p><b>입장은 Lua 한 스크립트다.</b> "만료자 정리 → 빈자리 계산 → 앞사람 꺼내기 → 입장 등록" 이
 * 갈라지면 블루/그린 전환 중 두 인스턴스가 같은 사람을 두 번 꺼내거나 정원을 넘긴다.
 */
@Repository
@RequiredArgsConstructor
public class QueueRedisRepository {

    private static final String PREFIX = "queue:";
    private static final String ENABLED_SET = PREFIX + "enabled";
    private static final String LOCK_KEY = PREFIX + "admitter:lock";

    /** config 해시의 필드. 서비스가 override 를 읽고 쓸 때 같은 이름을 쓴다 */
    public static final String FIELD_ENABLED = "enabled";
    public static final String FIELD_CAPACITY = "capacity";
    public static final String FIELD_MAX_PER_TICK = "maxPerTick";
    public static final String FIELD_TTL_SEC = "ttlSec";

    /** 대기열 키의 방어적 TTL. 회차가 끝났는데 관리자가 정리를 잊어도 하루 뒤엔 사라진다 */
    private static final Duration WAITING_KEY_TTL = Duration.ofHours(24);
    /** 입장 속도 버킷 폭과 수명. 60초 창을 보려면 버킷 6개 + 여유 */
    static final long RATE_BUCKET_SEC = 10;
    private static final Duration RATE_KEY_TTL = Duration.ofSeconds(80);

    /**
     * KEYS[1] waiting  KEYS[2] admitted  KEYS[3] config
     * ARGV[1] nowMs  ARGV[2] capacity(env)  ARGV[3] maxPerTick(env)  ARGV[4] ttlSec(env)
     *
     * 서버가 환경변수 값을 ARGV 로 넘기고, config 해시에 같은 필드가 있으면 그 값이 우선한다(회차별 override).
     * 반환: 이번 틱에 입장한 userId 목록.
     */
    private static final String ADMIT_LUA = """
            local cfg = redis.call('HMGET', KEYS[3], 'enabled', 'capacity', 'maxPerTick', 'ttlSec')
            if cfg[1] ~= '1' then return {} end
            local now        = tonumber(ARGV[1])
            local capacity   = tonumber(cfg[2] or ARGV[2])
            local maxPerTick = tonumber(cfg[3] or ARGV[3])
            local ttlMs      = tonumber(cfg[4] or ARGV[4]) * 1000

            redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
            local current = redis.call('ZCOUNT', KEYS[2], now, '+inf')
            local free    = math.min(capacity - current, maxPerTick)
            if free <= 0 then return {} end

            local popped   = redis.call('ZPOPMIN', KEYS[1], free)
            local admitted = {}
            for i = 1, #popped, 2 do
              redis.call('ZADD', KEYS[2], now + ttlMs, popped[i])
              admitted[#admitted + 1] = popped[i]
            end
            return admitted
            """;

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static final RedisScript<List> ADMIT_SCRIPT = new DefaultRedisScript<>(ADMIT_LUA, List.class);

    private final StringRedisTemplate redisTemplate;

    // ── 대기열 ─────────────────────────────────────────────────

    /**
     * 대기열에 세운다. 이미 서 있으면 순번을 바꾸지 않는다(NX) — 새로고침해도 자리를 잃지 않는다.
     *
     * @return 새로 들어갔으면 true, 이미 있었으면 false
     */
    public boolean enter(Long scheduleId, Long userId, long nowMs) {
        String key = waitingKey(scheduleId);
        Boolean added = redisTemplate.opsForZSet().addIfAbsent(key, String.valueOf(userId), nowMs);
        redisTemplate.expire(key, WAITING_KEY_TTL);
        return Boolean.TRUE.equals(added);
    }

    /** 0-base 순번. 대기열에 없으면 empty */
    public Optional<Long> rank(Long scheduleId, Long userId) {
        return Optional.ofNullable(redisTemplate.opsForZSet().rank(waitingKey(scheduleId), String.valueOf(userId)));
    }

    public long waitingCount(Long scheduleId) {
        Long size = redisTemplate.opsForZSet().zCard(waitingKey(scheduleId));
        return size == null ? 0 : size;
    }

    // ── 입장 표식 ───────────────────────────────────────────────

    /** 입장 표식이 있고 아직 만료 전이면 true */
    public boolean isAdmitted(Long scheduleId, Long userId, long nowMs) {
        Double expiresAt = redisTemplate.opsForZSet().score(admittedKey(scheduleId), String.valueOf(userId));
        return expiresAt != null && expiresAt > nowMs;
    }

    /** 활동이 있었다 — 만료 시각을 뒤로 민다. 입장과 같은 명령(ZADD)이라 표식이 없으면 새로 생기는데, 호출 전에 isAdmitted 로 걸러야 한다 */
    public void touch(Long scheduleId, Long userId, long expiresAtMs) {
        redisTemplate.opsForZSet().add(admittedKey(scheduleId), String.valueOf(userId), expiresAtMs);
    }

    /** 지금 유효한 입장 인원 */
    public long admittedCount(Long scheduleId, long nowMs) {
        Long count = redisTemplate.opsForZSet().count(admittedKey(scheduleId), nowMs, Double.POSITIVE_INFINITY);
        return count == null ? 0 : count;
    }

    /** 대기열과 입장 표식에서 모두 뺀다 (결제 완료 · 뒤로가기 · 탭 닫기) */
    public void leave(Long scheduleId, Long userId) {
        String member = String.valueOf(userId);
        redisTemplate.opsForZSet().remove(waitingKey(scheduleId), member);
        redisTemplate.opsForZSet().remove(admittedKey(scheduleId), member);
    }

    // ── 입장 관리자 ─────────────────────────────────────────────

    /**
     * 한 틱의 입장 처리. 4장 Lua 를 원자적으로 실행한다.
     *
     * @return 이번에 입장한 userId. 대기실이 꺼져 있거나 빈자리가 없으면 빈 목록
     */
    @SuppressWarnings("unchecked")
    public List<Long> admit(Long scheduleId, long nowMs, int capacity, int maxPerTick, long ttlSec) {
        List<Object> result = redisTemplate.execute(
                ADMIT_SCRIPT,
                List.of(waitingKey(scheduleId), admittedKey(scheduleId), configKey(scheduleId)),
                String.valueOf(nowMs), String.valueOf(capacity), String.valueOf(maxPerTick), String.valueOf(ttlSec));
        if (result == null || result.isEmpty()) {
            return List.of();
        }
        List<Long> admitted = new ArrayList<>(result.size());
        for (Object member : result) {
            admitted.add(Long.valueOf(String.valueOf(member)));
        }
        return admitted;
    }

    /** SET NX EX. 해제하지 않고 TTL 로 흘려보낸다 — 주기 1초·TTL 2초면 한 틱에 한 인스턴스만 돈다 */
    public boolean tryLock(Duration ttl) {
        return Boolean.TRUE.equals(redisTemplate.opsForValue().setIfAbsent(LOCK_KEY, "1", ttl));
    }

    /** 락을 즉시 푼다. 운영 코드는 부르지 않는다(TTL 로 흘려보낸다). 테스트가 틱을 연속으로 돌릴 때만 쓴다 */
    public void releaseLock() {
        redisTemplate.delete(LOCK_KEY);
    }

    /** 이번 틱 입장 수를 10초 버킷에 더한다. 예상 대기 시간(입장 속도) 계산용 */
    public void recordAdmits(Long scheduleId, int count, long nowMs) {
        String key = rateKey(scheduleId, nowMs / 1000 / RATE_BUCKET_SEC);
        redisTemplate.opsForValue().increment(key, count);
        redisTemplate.expire(key, RATE_KEY_TTL);
    }

    /** 최근 60초 입장 수 (버킷 6개 합) */
    public long admitsLast60s(Long scheduleId, long nowMs) {
        long bucket = nowMs / 1000 / RATE_BUCKET_SEC;
        List<String> keys = new ArrayList<>(6);
        for (long b = bucket - 5; b <= bucket; b++) {
            keys.add(rateKey(scheduleId, b));
        }
        List<String> values = redisTemplate.opsForValue().multiGet(keys);
        if (values == null) {
            return 0;
        }
        return values.stream().filter(v -> v != null).mapToLong(Long::parseLong).sum();
    }

    // ── 설정 ───────────────────────────────────────────────────

    public boolean isEnabled(Long scheduleId) {
        return "1".equals(redisTemplate.opsForHash().get(configKey(scheduleId), FIELD_ENABLED));
    }

    /** 켜고 끈다. 입장 관리자가 돌 회차 집합(queue:enabled)도 함께 맞춘다 */
    public void setEnabled(Long scheduleId, boolean enabled) {
        redisTemplate.opsForHash().put(configKey(scheduleId), FIELD_ENABLED, enabled ? "1" : "0");
        if (enabled) {
            redisTemplate.opsForSet().add(ENABLED_SET, String.valueOf(scheduleId));
        } else {
            redisTemplate.opsForSet().remove(ENABLED_SET, String.valueOf(scheduleId));
        }
    }

    /** 회차별 override. null 이면 지운다(환경변수 값으로 돌아간다) */
    public void setOverride(Long scheduleId, String field, Integer value) {
        if (value == null) {
            redisTemplate.opsForHash().delete(configKey(scheduleId), field);
        } else {
            redisTemplate.opsForHash().put(configKey(scheduleId), field, String.valueOf(value));
        }
    }

    public Optional<Integer> override(Long scheduleId, String field) {
        Object value = redisTemplate.opsForHash().get(configKey(scheduleId), field);
        return Optional.ofNullable(value).map(v -> Integer.valueOf(v.toString()));
    }

    public Map<Object, Object> config(Long scheduleId) {
        return redisTemplate.opsForHash().entries(configKey(scheduleId));
    }

    public Set<Long> enabledScheduleIds() {
        Set<String> members = redisTemplate.opsForSet().members(ENABLED_SET);
        if (members == null) {
            return Set.of();
        }
        return members.stream().map(Long::valueOf).collect(Collectors.toSet());
    }

    /** 회차 종료 후 정리. 대기열 · 입장 표식 · 설정 · 속도 버킷을 모두 지운다 */
    public void clear(Long scheduleId, long nowMs) {
        List<String> keys = new ArrayList<>(List.of(
                waitingKey(scheduleId), admittedKey(scheduleId), configKey(scheduleId)));
        long bucket = nowMs / 1000 / RATE_BUCKET_SEC;
        for (long b = bucket - 8; b <= bucket + 1; b++) {
            keys.add(rateKey(scheduleId, b));
        }
        redisTemplate.delete(keys);
        redisTemplate.opsForSet().remove(ENABLED_SET, String.valueOf(scheduleId));
    }

    // ── 키 ────────────────────────────────────────────────────

    private static String waitingKey(Long scheduleId) {
        return PREFIX + scheduleId + ":waiting";
    }

    private static String admittedKey(Long scheduleId) {
        return PREFIX + scheduleId + ":admitted";
    }

    private static String configKey(Long scheduleId) {
        return PREFIX + scheduleId + ":config";
    }

    private static String rateKey(Long scheduleId, long bucket) {
        return PREFIX + scheduleId + ":rate:" + bucket;
    }
}
