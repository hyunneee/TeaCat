package com.teacat.server.sticker.service;

import com.teacat.server.common.config.StickerProperties;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.sticker.repository.StickerJobRepository;
import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 방치된 작업 정리.
 *
 * <p>🔴 <b>스위퍼를 주입받지 않고 직접 만든다.</b> 빈이 {@code @ConditionalOnProperty} 인데
 * 기반 클래스가 {@code sticker.sweep-enabled=false} 로 꺼 두기 때문이다 — 그리고 그건
 * {@code @DynamicPropertySource} 라 {@code @TestPropertySource} 로 되돌릴 수 없다
 * (동적 속성이 우선순위가 더 높다). 스케줄러가 테스트 중에 끼어드는 것도 이 편이 확실하다.
 *
 * <p>대신 {@code @Transactional} 프록시도 없으므로 {@link TransactionTemplate} 으로 감싼다.
 * 여기서 보려는 건 트랜잭션 경계가 아니라 <b>SQL 세 문장과 그 실행 순서</b>다.
 */
class StickerSweeperIntegrationTests extends PostgresIntegrationTest {

    @Autowired
    private StickerJobRepository jobRepository;

    @Autowired
    private StickerProperties stickerProperties;

    @Autowired
    private StickerService stickerService;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @MockitoBean
    private FileStorageService fileStorageService;

    /** 🔴 체인을 태우지 않는다. 이 시험은 "정리" 를 보는 것이고 환불은 다른 시험이 본다 */
    @MockitoBean
    private com.teacat.server.wallet.service.CatMoneyService catMoneyService;

    private StickerJobSweeper sweeper;
    private TransactionTemplate transactionTemplate;
    private Long userId;

    @BeforeEach
    void setUp() {
        sweeper = new StickerJobSweeper(jobRepository, stickerProperties, catMoneyService);
        transactionTemplate = new TransactionTemplate(transactionManager);
        userId = insertUser("sweeper@test.com", "스위퍼");
    }

    /** 프록시가 없으니 트랜잭션은 여기서 연다 */
    private void sweep() {
        transactionTemplate.executeWithoutResult(status -> sweeper.sweep());
    }

    /** 집어간 지 {@code minutesAgo} 분 지난 RUNNING 작업 */
    private Long insertRunning(int minutesAgo, int retryCount) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO sticker_jobs (user_id, status, idempotency_key, sketch_key, seed,
                                          worker_id, retry_count, claimed_at)
                VALUES (?, 'RUNNING', ?, 'sticker/sketch/a.png', 1, 'gpu-01', ?,
                        now() - make_interval(mins => ?))
                RETURNING id
                """, Long.class, userId, UUID.randomUUID().toString(), retryCount, minutesAgo);
    }

    /** 만든 지 {@code minutesAgo} 분 지난 PENDING 작업 */
    private Long insertPending(int minutesAgo) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO sticker_jobs (user_id, status, idempotency_key, sketch_key, seed, created_at)
                VALUES (?, 'PENDING', ?, 'sticker/sketch/a.png', 1, now() - make_interval(mins => ?))
                RETURNING id
                """, Long.class, userId, UUID.randomUUID().toString(), minutesAgo);
    }

    private String statusOf(Long jobId) {
        return jdbcTemplate.queryForObject("SELECT status FROM sticker_jobs WHERE id = ?", String.class, jobId);
    }

    private String reasonOf(Long jobId) {
        return jdbcTemplate.queryForObject("SELECT fail_reason FROM sticker_jobs WHERE id = ?", String.class, jobId);
    }

    private int retryOf(Long jobId) {
        return jdbcTemplate.queryForObject("SELECT retry_count FROM sticker_jobs WHERE id = ?", Integer.class, jobId);
    }

    @Test
    void 아직_시간이_안_된_작업은_건드리지_않는다() {
        Long fresh = insertRunning(1, 0);

        sweep();

        assertThat(statusOf(fresh)).isEqualTo("RUNNING");
        assertThat(retryOf(fresh)).isZero();
    }

    @Test
    void 소식이_끊긴_작업은_다시_줄을_세운다() {
        Long stalled = insertRunning(10, 0);

        sweep();

        assertThat(statusOf(stalled)).isEqualTo("PENDING");
        assertThat(retryOf(stalled)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT claimed_at IS NULL AND worker_id IS NULL FROM sticker_jobs WHERE id = ?",
                Boolean.class, stalled)).isTrue();
    }

    @Test
    void 되돌림을_다_쓴_작업은_실패로_끝낸다() {
        Long exhausted = insertRunning(10, 3);

        sweep();

        assertThat(statusOf(exhausted)).isEqualTo("FAILED");
        assertThat(reasonOf(exhausted)).isEqualTo("RETRY_EXHAUSTED");
    }

    /**
     * 🔴 <b>스위퍼 안의 실행 순서를 지키는 테스트다.</b>
     *
     * <p>되돌림을 먼저 돌리면 {@code retry_count} 가 2 → 3 이 된 작업이 <b>같은 판의</b>
     * 소진 검사에 또 걸려, 한 번도 재시도하지 못하고 FAILED 가 된다. 재시도가 통째로 죽어도
     * 겉으로는 아무 일 없어 보이므로 눈으로는 절대 못 찾는다.
     */
    @Test
    void 이번_판에_상한에_닿은_작업이_같은_판에서_실패하지_않는다() {
        Long almost = insertRunning(10, 2);

        sweep();

        assertThat(statusOf(almost)).isEqualTo("PENDING");
        assertThat(retryOf(almost)).isEqualTo(3);

        // 한 번 더 집혔다가 또 끊기면 그때 끝난다
        jdbcTemplate.update(
                "UPDATE sticker_jobs SET status = 'RUNNING', claimed_at = now() - interval '10 minutes' WHERE id = ?",
                almost);
        sweep();

        assertThat(statusOf(almost)).isEqualTo("FAILED");
        assertThat(reasonOf(almost)).isEqualTo("RETRY_EXHAUSTED");
    }

    /**
     * 🔴 원래 설계에 없던 판이다. 워커가 <b>아예 안 떠 있으면</b> 작업은 RUNNING 이 되질 않아
     * 위 판들에 걸리지 않고, 화면은 영원히 "그리고 있어요" 에 멈춘다.
     * 발표 당일 노트북을 안 띄운 경우가 정확히 여기다.
     */
    @Test
    void 아무도_집어가지_않은_작업은_포기한다() {
        Long abandoned = insertPending(20);

        sweep();

        assertThat(statusOf(abandoned)).isEqualTo("FAILED");
        assertThat(reasonOf(abandoned)).isEqualTo("NO_WORKER");
    }

    @Test
    void 방금_만든_작업은_포기하지_않는다() {
        Long fresh = insertPending(1);

        sweep();

        assertThat(statusOf(fresh)).isEqualTo("PENDING");
    }

    /** 스위퍼가 실패로 끝낸 작업은 오늘 몫에서 빠진다 — 워커 장애로 몫이 깎이지 않는다 */
    @Test
    void 포기한_작업만큼_오늘_몫이_돌아온다() {
        insertPending(20);
        insertPending(20);
        assertThat(stickerService.quota(userId).used()).isEqualTo(2);

        sweep();

        assertThat(stickerService.quota(userId).used()).isZero();
        assertThat(stickerService.quota(userId).remaining()).isEqualTo(5);
    }

    @Test
    void 정리할_것이_없어도_그냥_지나간다() {
        sweep();

        assertThat(jdbcTemplate.queryForObject("SELECT count(*)::int FROM sticker_jobs", Integer.class)).isZero();
    }
}
