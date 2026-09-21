package com.teacat.server.sticker.service;

import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.sticker.dto.response.StickerJobClaimResponse;
import com.teacat.server.sticker.repository.StickerJobRepository;
import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

/**
 * 워커가 일감을 집는 한 문장.
 *
 * <p>🔴 <b>이 클래스가 {@code FOR UPDATE SKIP LOCKED} 의 존재 이유다.</b> 고르기와 표시를
 * 두 문장으로 나누면 그 사이가 경쟁 구간이고, GPU 두 장에 워커 둘을 띄우는 순간 같은 낙서를
 * 두 번 그린다. 단일 스레드 테스트로는 절대 안 잡히므로 <b>실제로 잠금을 걸어</b> 확인한다.
 */
class StickerJobClaimIntegrationTests extends PostgresIntegrationTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};

    @Autowired
    private StickerJobRepository jobRepository;

    @Autowired
    private StickerJobWorkerService workerService;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @MockitoBean
    private FileStorageService fileStorageService;

    private TransactionTemplate transactionTemplate;

    @BeforeEach
    void setUp() {
        transactionTemplate = new TransactionTemplate(transactionManager);
        given(fileStorageService.download(anyString())).willReturn(PNG);
    }

    private Long insertPendingJob(Long userId, String subject, int seed) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO sticker_jobs (user_id, status, idempotency_key, sketch_key, subject, seed)
                VALUES (?, 'PENDING', ?, 'sticker/sketch/a.png', ?, ?)
                RETURNING id
                """, Long.class, userId, UUID.randomUUID().toString(), subject, seed);
    }

    private String statusOf(Long jobId) {
        return jdbcTemplate.queryForObject("SELECT status FROM sticker_jobs WHERE id = ?", String.class, jobId);
    }

    @Test
    void 기다리는_작업이_없으면_비어_있다() {
        assertThat(workerService.claimNext("worker-1")).isEmpty();
    }

    @Test
    void 집어가면_RUNNING_이_되고_낙서와_주제와_시드가_함께_온다() {
        Long userId = insertUser("claim@test.com", "집기");
        Long jobId = insertPendingJob(userId, "고양이", 777);

        StickerJobClaimResponse claimed = workerService.claimNext("worker-1").orElseThrow();

        assertThat(claimed.jobId()).isEqualTo(jobId);
        assertThat(claimed.subject()).isEqualTo("고양이");
        // 🔴 seed 가 null 이면 워커가 자기 기본값을 써서 "다시 만들기" 가 같은 그림을 준다
        assertThat(claimed.seed()).isEqualTo(777);
        assertThat(claimed.sketchBase64()).isNotBlank();
        assertThat(statusOf(jobId)).isEqualTo("RUNNING");
    }

    @Test
    void 가장_오래_기다린_작업을_먼저_준다() {
        Long userId = insertUser("claim-order@test.com", "순서");
        Long first = insertPendingJob(userId, null, 1);
        Long second = insertPendingJob(userId, null, 2);
        jdbcTemplate.update("UPDATE sticker_jobs SET created_at = now() - interval '1 hour' WHERE id = ?", first);

        assertThat(workerService.claimNext("worker-1").orElseThrow().jobId()).isEqualTo(first);
        assertThat(workerService.claimNext("worker-2").orElseThrow().jobId()).isEqualTo(second);
    }

    /**
     * 🔴 앞 워커가 <b>아직 커밋하지 않은</b> 행을 뒤 워커가 어떻게 다루는가.
     *
     * <p>{@code SKIP LOCKED} 가 빠지면 뒤 워커는 잠긴 행을 <b>기다린다</b> — 앞 워커가 끝날 때까지
     * 멈춰 있다가 결국 같은 행을 집는다. 여기서는 타임아웃으로 드러난다.
     */
    @Test
    void 앞_워커가_잡고_있는_작업은_기다리지_않고_건너뛴다() {
        Long userId = insertUser("claim-skip@test.com", "건너뛰기");
        insertPendingJob(userId, null, 1);
        insertPendingJob(userId, null, 2);

        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            transactionTemplate.executeWithoutResult(status -> {
                Long mine = jobRepository.claimNext("worker-1").orElseThrow();

                // 여기서 이 트랜잭션은 아직 커밋 전이다. mine 행에는 잠금이 걸려 있다
                Future<Optional<Long>> other = pool.submit(() ->
                        transactionTemplate.execute(inner -> jobRepository.claimNext("worker-2")));

                Optional<Long> theirs;
                try {
                    theirs = other.get(10, TimeUnit.SECONDS);
                } catch (Exception e) {
                    throw new AssertionError("두 번째 워커가 잠긴 행을 기다렸습니다. SKIP LOCKED 가 빠졌습니다.", e);
                }

                assertThat(theirs).isPresent();
                assertThat(theirs.orElseThrow()).isNotEqualTo(mine);
            });
        } finally {
            pool.shutdownNow();
        }
    }

    /** 남은 게 잠긴 하나뿐이면 뒤 워커는 빈손으로 돌아간다 — 기다리지 않는다 */
    @Test
    void 남은_작업이_모두_잠겨_있으면_빈손으로_돌아간다() {
        Long userId = insertUser("claim-empty@test.com", "빈손");
        insertPendingJob(userId, null, 1);

        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            transactionTemplate.executeWithoutResult(status -> {
                jobRepository.claimNext("worker-1").orElseThrow();

                Future<Optional<Long>> other = pool.submit(() ->
                        transactionTemplate.execute(inner -> jobRepository.claimNext("worker-2")));

                Optional<Long> theirs;
                try {
                    theirs = other.get(10, TimeUnit.SECONDS);
                } catch (Exception e) {
                    throw new AssertionError("두 번째 워커가 잠긴 행을 기다렸습니다. SKIP LOCKED 가 빠졌습니다.", e);
                }

                assertThat(theirs).isEmpty();
            });
        } finally {
            pool.shutdownNow();
        }
    }
}
