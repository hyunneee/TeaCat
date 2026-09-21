package com.teacat.server.queue;

import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.queue.repository.QueueRedisRepository;
import com.teacat.server.queue.service.QueueAdmissionChecker;
import com.teacat.server.queue.service.QueueAdmitter;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.GenericContainer;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 가상 대기실 통합 테스트. Postgres 컨테이너(기반 클래스) 위에 Redis 컨테이너를 하나 더 띄운다.
 *
 * <p>정원을 1 로 좁혀 "정원이 차면 뒤사람은 기다린다" 를 두 사용자로 재현한다.
 * 입장 관리자는 스케줄러를 끄고 {@link QueueAdmitter#runOnce()} 를 직접 부른다 — 틱 타이밍에 기대지 않는다.
 */
class QueueIntegrationTests extends PostgresIntegrationTest {

    // application.yaml 의 로컬 기본 비밀번호(teacat_local_pw)를 그대로 쓰게 requirepass 를 맞춘다.
    // 비밀번호 없는 Redis 에 AUTH 를 보내면 Redis 가 오류를 내고 연결이 안 된다
    static final GenericContainer<?> REDIS = new GenericContainer<>("redis:8-alpine")
            .withCommand("redis-server", "--requirepass", "teacat_local_pw")
            .withExposedPorts(6379);

    static {
        REDIS.start();
    }

    @DynamicPropertySource
    static void queueProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
        registry.add("queue.admitter-enabled", () -> "false");
        // 정원 1 · 틱당 1. 틱 상한이 정원보다 크면 설정 API 가 ERR_QUEUE_004 로 거절한다
        registry.add("queue.capacity", () -> "1");
        registry.add("queue.max-per-tick", () -> "1");
    }

    @Autowired
    MockMvc mockMvc;
    @Autowired
    JwtTokenProvider jwtTokenProvider;
    @Autowired
    StringRedisTemplate redisTemplate;
    @Autowired
    QueueAdmitter admitter;
    @Autowired
    QueueRedisRepository queueRepository;
    @Autowired
    QueueAdmissionChecker admissionChecker;

    Long scheduleId;
    String userA;
    String userB;
    String admin;

    @BeforeEach
    void setUpQueue() {
        Set<String> keys = redisTemplate.keys("queue:*");
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
        // TRUNCATE ... RESTART IDENTITY 라 회차 ID 가 테스트마다 같다. 인터셉터의 1초 캐시가 이전 테스트의 enabled 를 들고 있으면 안 된다
        admissionChecker.invalidateAll();
        scheduleId = insertPerformanceFixture().performanceDetailId();
        userA = bearer(insertUser("a@test.com", "에이"), UserRole.USER);
        userB = bearer(insertUser("b@test.com", "비"), UserRole.USER);
        admin = bearer(insertUser("admin@test.com", "관리자", "ADMIN"), UserRole.ADMIN);
    }

    @Test
    @DisplayName("대기실이 꺼진 회차(기본 상태)는 status 가 admitted=true 이고 좌석맵은 그대로 통과한다")
    void disabledQueueIsTransparent() throws Exception {
        mockMvc.perform(get("/queue/{id}/status", scheduleId).header(AUTHORIZATION, userA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(false))
                .andExpect(jsonPath("$.data.admitted").value(true));

        // 비로그인 좌석맵 조회도 지금처럼 된다
        mockMvc.perform(get("/schedules/{id}/seats", scheduleId))
                .andExpect(status().isOk());

        // 꺼진 회차에 enter 는 409
        mockMvc.perform(post("/queue/{id}/enter", scheduleId).header(AUTHORIZATION, userA))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ERR_QUEUE_003"));
    }

    @Test
    @DisplayName("정원(1)이 차면 뒤사람은 대기하고, 좌석맵·선점 API 는 428 로 대기실로 돌려보낸다")
    void capacityIsEnforced() throws Exception {
        enableQueue();

        mockMvc.perform(post("/queue/{id}/enter", scheduleId).header(AUTHORIZATION, userA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.admitted").value(false))
                .andExpect(jsonPath("$.data.position").value(1));
        mockMvc.perform(post("/queue/{id}/enter", scheduleId).header(AUTHORIZATION, userB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.position").value(2))
                .andExpect(jsonPath("$.data.waitingAhead").value(1));

        // 입장 전에는 둘 다 좌석맵을 못 본다
        mockMvc.perform(get("/schedules/{id}/seats", scheduleId).header(AUTHORIZATION, userA))
                .andExpect(status().isPreconditionRequired())
                .andExpect(jsonPath("$.code").value("ERR_QUEUE_002"));

        tick();

        // 정원 1: A 만 입장, B 는 맨 앞에서 대기
        mockMvc.perform(get("/queue/{id}/status", scheduleId).header(AUTHORIZATION, userA))
                .andExpect(jsonPath("$.data.admitted").value(true));
        mockMvc.perform(get("/queue/{id}/status", scheduleId).header(AUTHORIZATION, userB))
                .andExpect(jsonPath("$.data.admitted").value(false))
                .andExpect(jsonPath("$.data.position").value(1))
                .andExpect(jsonPath("$.data.waitingAhead").value(0));

        mockMvc.perform(get("/schedules/{id}/seats", scheduleId).header(AUTHORIZATION, userA))
                .andExpect(status().isOk());
        mockMvc.perform(get("/schedules/{id}/seats", scheduleId).header(AUTHORIZATION, userB))
                .andExpect(status().isPreconditionRequired());

        // 한 번 더 돌려도 정원을 넘기지 않는다
        tick();
        assertThat(queueRepository.admittedCount(scheduleId, System.currentTimeMillis())).isEqualTo(1);

        // A 가 나가면 다음 틱에 B 가 들어온다
        mockMvc.perform(delete("/queue/{id}/leave", scheduleId).header(AUTHORIZATION, userA))
                .andExpect(status().isOk());
        tick();
        mockMvc.perform(get("/queue/{id}/status", scheduleId).header(AUTHORIZATION, userB))
                .andExpect(jsonPath("$.data.admitted").value(true));
        mockMvc.perform(get("/schedules/{id}/seats", scheduleId).header(AUTHORIZATION, userB))
                .andExpect(status().isOk());
        // 나간 A 는 다시 막힌다
        mockMvc.perform(get("/schedules/{id}/seats", scheduleId).header(AUTHORIZATION, userA))
                .andExpect(status().isPreconditionRequired());
    }

    @Test
    @DisplayName("대기실이 켜진 회차는 비로그인 좌석맵 조회를 428 로 막는다 (대기열 우회 차단)")
    void anonymousIsRejectedWhenEnabled() throws Exception {
        enableQueue();
        mockMvc.perform(get("/schedules/{id}/seats", scheduleId))
                .andExpect(status().isPreconditionRequired())
                .andExpect(jsonPath("$.code").value("ERR_QUEUE_002"));
    }

    @Test
    @DisplayName("enter 를 다시 불러도(새로고침) 순번이 유지되고, 입장 뒤에는 admitted 를 그대로 돌려준다")
    void enterIsIdempotent() throws Exception {
        enableQueue();
        mockMvc.perform(post("/queue/{id}/enter", scheduleId).header(AUTHORIZATION, userA));
        mockMvc.perform(post("/queue/{id}/enter", scheduleId).header(AUTHORIZATION, userB));
        mockMvc.perform(post("/queue/{id}/enter", scheduleId).header(AUTHORIZATION, userA))
                .andExpect(jsonPath("$.data.position").value(1));

        tick();
        mockMvc.perform(post("/queue/{id}/enter", scheduleId).header(AUTHORIZATION, userA))
                .andExpect(jsonPath("$.data.admitted").value(true));
        // 입장한 A 가 enter 를 다시 불러도 대기열에 다시 서지 않는다
        assertThat(queueRepository.waitingCount(scheduleId)).isEqualTo(1);
    }

    @Test
    @DisplayName("회차별 override 가 환경변수 정원보다 우선하고, 틱 상한(maxPerTick)을 지킨다")
    void overrideAndMaxPerTick() throws Exception {
        // 정원 3, 틱당 2
        mockMvc.perform(put("/admin/queue/{id}/config", scheduleId).header(AUTHORIZATION, admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled": true, "capacity": 3, "maxPerTick": 2}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.capacity").value(3))
                .andExpect(jsonPath("$.data.capacityOverride").value(3));

        for (int i = 0; i < 5; i++) {
            Long userId = insertUser("u" + i + "@test.com", "유저" + i);
            queueRepository.enter(scheduleId, userId, System.currentTimeMillis() + i);
        }

        tick();
        assertThat(queueRepository.admittedCount(scheduleId, System.currentTimeMillis())).isEqualTo(2);
        tick();
        assertThat(queueRepository.admittedCount(scheduleId, System.currentTimeMillis())).isEqualTo(3);
        assertThat(queueRepository.waitingCount(scheduleId)).isEqualTo(2);

        // maxPerTick > capacity 는 뜻이 없는 설정이다
        mockMvc.perform(put("/admin/queue/{id}/config", scheduleId).header(AUTHORIZATION, admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled": true, "capacity": 3, "maxPerTick": 5}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ERR_QUEUE_004"));
    }

    @Test
    @DisplayName("관리자 API 는 ADMIN 만 쓸 수 있고, 초기화하면 대기열·설정이 사라진다")
    void adminEndpoints() throws Exception {
        mockMvc.perform(get("/admin/queue/{id}", scheduleId).header(AUTHORIZATION, userA))
                .andExpect(status().isForbidden());

        enableQueue();
        mockMvc.perform(post("/queue/{id}/enter", scheduleId).header(AUTHORIZATION, userA));
        mockMvc.perform(get("/admin/queue/{id}", scheduleId).header(AUTHORIZATION, admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(true))
                .andExpect(jsonPath("$.data.waiting").value(1))
                .andExpect(jsonPath("$.data.capacity").value(1));

        mockMvc.perform(delete("/admin/queue/{id}", scheduleId).header(AUTHORIZATION, admin))
                .andExpect(status().isOk());
        mockMvc.perform(get("/admin/queue/{id}", scheduleId).header(AUTHORIZATION, admin))
                .andExpect(jsonPath("$.data.enabled").value(false))
                .andExpect(jsonPath("$.data.waiting").value(0));
        assertThat(queueRepository.enabledScheduleIds()).doesNotContain(scheduleId);
    }

    @Test
    @DisplayName("없는 회차에 enter 하면 404")
    void unknownSchedule() throws Exception {
        mockMvc.perform(post("/queue/{id}/enter", 999_999L).header(AUTHORIZATION, userA))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ERR_QUEUE_001"));
    }

    /** 입장 관리자 한 틱. 운영에서는 락 TTL(2초)로 연속 실행을 막지만, 테스트는 기다리지 않고 락을 풀고 돈다 */
    private void tick() {
        queueRepository.releaseLock();
        admitter.runOnce();
    }

    private void enableQueue() throws Exception {
        mockMvc.perform(put("/admin/queue/{id}/config", scheduleId)
                        .header(AUTHORIZATION, admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled": true}
                                """))
                .andExpect(status().isOk());
    }

    private String bearer(Long userId, UserRole role) {
        return "Bearer " + jwtTokenProvider.createAccessToken(userId, role);
    }
}
