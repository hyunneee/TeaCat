package com.teacat.server.sticker.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.sticker.dto.request.StickerCreateRequest;
import com.teacat.server.sticker.dto.response.StickerCreateResponse;
import com.teacat.server.sticker.entity.StickerJob;
import com.teacat.server.sticker.entity.StickerJobStatus;
import com.teacat.server.sticker.exception.StickerErrorCode;
import com.teacat.server.sticker.repository.StickerJobRepository;
import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * 스티커 생성 — 멱등키 · 오늘 몫 · KST 경계.
 *
 * <p>MinIO 는 {@link MockitoBean} 으로 갈아끼운다. 여기서 보려는 건 저장소가 아니라
 * <b>몇 번 올렸는가</b>와 <b>작업 행이 어떻게 남는가</b>다.
 */
class StickerCreateIntegrationTests extends PostgresIntegrationTest {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};

    @Autowired
    private StickerService stickerService;

    @Autowired
    private StickerJobRepository jobRepository;

    @MockitoBean
    private FileStorageService fileStorageService;

    @BeforeEach
    void stubStorage() {
        given(fileStorageService.uploadBytes(any(), any(), any())).willReturn("sticker/sketch/test.png");
    }

    private static StickerCreateRequest request() {
        return new StickerCreateRequest(Base64.getEncoder().encodeToString(PNG), null, null, null);
    }

    private static String newKey() {
        return UUID.randomUUID().toString();
    }

    /** 규칙을 우회해 특정 시각의 작업을 심는다. KST 경계 검사처럼 "이미 있는 작업" 이 필요할 때만 쓴다 */
    private void insertJobAt(Long userId, Instant createdAt, StickerJobStatus status) {
        jdbcTemplate.update("""
                INSERT INTO sticker_jobs (user_id, status, idempotency_key, sketch_key, seed, created_at)
                VALUES (?, ?, ?, 'sticker/sketch/seed.png', 1, ?)
                """, userId, status.name(), newKey(), OffsetDateTime.ofInstant(createdAt, ZoneOffset.UTC));
    }

    @Test
    void 같은_멱등키로_두_번_보내면_작업은_하나고_두_번째는_올리지_않는다() {
        Long userId = insertUser("sticker-idem@test.com", "멱등");
        String key = newKey();

        StickerCreateResponse first = stickerService.create(userId, request(), key);
        StickerCreateResponse second = stickerService.create(userId, request(), key);

        assertThat(second.jobId()).isEqualTo(first.jobId());
        assertThat(jobRepository.count()).isEqualTo(1);

        /* 🔴 두 번째 요청은 멱등키에서 바로 끝나야 한다. 여기가 2가 되면 같은 낙서가
           MinIO 에 두 번 쌓이고, 재시도가 잦은 모바일에서 저장소가 조용히 불어난다 */
        verify(fileStorageService, times(1)).uploadBytes(any(), any(), any());
    }

    @Test
    void 오늘_몫을_다_쓰면_거절한다() {
        Long userId = insertUser("sticker-limit@test.com", "상한");

        for (int i = 0; i < 5; i++) {
            stickerService.create(userId, request(), newKey());
        }

        assertThat(stickerService.quota(userId).remaining()).isZero();
        assertThatThrownBy(() -> stickerService.create(userId, request(), newKey()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(StickerErrorCode.DAILY_LIMIT_EXCEEDED);
    }

    /**
     * 🔴 워커 장애로 실패한 건이 사용자 몫을 깎으면 안 된다. 그리고 이게 스위퍼가
     * 방치된 작업을 FAILED 로 끝내는 진짜 이득이다 — 몫이 돌아온다.
     */
    @Test
    void 실패한_작업은_오늘_몫을_쓰지_않는다() {
        Long userId = insertUser("sticker-failed@test.com", "실패");

        for (int i = 0; i < 5; i++) {
            stickerService.create(userId, request(), newKey());
        }
        jdbcTemplate.update("UPDATE sticker_jobs SET status = 'FAILED' WHERE user_id = ?", userId);

        assertThat(stickerService.quota(userId).used()).isZero();
        assertThat(stickerService.quota(userId).remaining()).isEqualTo(5);
    }

    /**
     * 🔴 이 설계에서 제일 조용히 틀리는 자리다.
     *
     * <p>DB 컨테이너는 UTC, 앱 컨테이너는 {@code TZ=Asia/Seoul} 이라 SQL 안에서
     * {@code now()::date} 로 자르면 <b>매일 09시 이전 요청이 어제 몫으로</b> 세어진다.
     * 새벽에는 쓰는 사람이 없어 운영에서 한참을 못 찾는다.
     */
    @Test
    void 어제_KST_에_만든_작업은_오늘_몫에_들어가지_않는다() {
        Long userId = insertUser("sticker-kst@test.com", "경계");
        Instant todayStart = LocalDate.now(KST).atStartOfDay(KST).toInstant();

        insertJobAt(userId, todayStart.minusSeconds(60), StickerJobStatus.DONE);  // KST 어제 23:59
        insertJobAt(userId, todayStart.plusSeconds(60), StickerJobStatus.DONE);   // KST 오늘 00:01

        assertThat(stickerService.quota(userId).used()).isEqualTo(1);
    }

    @Test
    void 남은_장수를_응답에_담아_준다() {
        Long userId = insertUser("sticker-remain@test.com", "잔여");

        assertThat(stickerService.create(userId, request(), newKey()).remainingToday()).isEqualTo(4);
        assertThat(stickerService.create(userId, request(), newKey()).remainingToday()).isEqualTo(3);
    }

    /**
     * 🔴 seed 가 null 로 남으면 워커가 자기 기본값을 쓰고, "다시 만들기" 가 같은 낙서로
     * <b>같은 그림</b>을 돌려준다. 사용자는 버튼이 고장 난 줄 안다.
     */
    @Test
    void seed_를_생략하면_서버가_채운다() {
        Long userId = insertUser("sticker-seed@test.com", "시드");

        StickerCreateResponse response = stickerService.create(userId, request(), newKey());

        StickerJob job = jobRepository.findById(response.jobId()).orElseThrow();
        assertThat(job.getSeed()).isNotNull();
        assertThat(job.getStatus()).isEqualTo(StickerJobStatus.PENDING);
    }

    @Test
    void seed_를_주면_그대로_쓴다() {
        Long userId = insertUser("sticker-seed2@test.com", "시드2");
        StickerCreateRequest request = new StickerCreateRequest(
                Base64.getEncoder().encodeToString(PNG), "고양이", 777, null);

        StickerCreateResponse response = stickerService.create(userId, request, newKey());

        StickerJob job = jobRepository.findById(response.jobId()).orElseThrow();
        assertThat(job.getSeed()).isEqualTo(777);
        assertThat(job.getSubject()).isEqualTo("고양이");
    }

    @Test
    void 낙서가_PNG_가_아니면_거절한다() {
        Long userId = insertUser("sticker-bad@test.com", "형식");
        StickerCreateRequest request = new StickerCreateRequest(
                Base64.getEncoder().encodeToString("그냥 글자".getBytes()), null, null, null);

        assertThatThrownBy(() -> stickerService.create(userId, request, newKey()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(StickerErrorCode.INVALID_SKETCH);
    }

    @Test
    void 멱등키가_UUID_가_아니면_거절한다() {
        Long userId = insertUser("sticker-key@test.com", "키");

        assertThatThrownBy(() -> stickerService.create(userId, request(), "not-a-uuid"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(StickerErrorCode.INVALID_IDEMPOTENCY_KEY);
    }

    /** 멱등키가 없어도 형식 오류다. 헤더를 빠뜨린 클라이언트가 조용히 중복 생성하면 안 된다 */
    @Test
    void 멱등키가_없으면_거절한다() {
        Long userId = insertUser("sticker-nokey@test.com", "무키");

        assertThatThrownBy(() -> stickerService.create(userId, request(), null))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(StickerErrorCode.INVALID_IDEMPOTENCY_KEY);
    }
}
