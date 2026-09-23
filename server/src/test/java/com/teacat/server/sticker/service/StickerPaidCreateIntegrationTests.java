package com.teacat.server.sticker.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.sticker.dto.request.StickerCreateRequest;
import com.teacat.server.sticker.exception.StickerErrorCode;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.wallet.entity.CatTxReason;
import com.teacat.server.wallet.service.CatMoneyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigInteger;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 스티커 만들기 — <b>하루 5장은 공짜, 그 뒤는 1장당 캣머니</b> (2026-09-23).
 *
 * <p>🔴 예전에는 하루 몫을 넘기면 {@code STICKER_001} 로 <b>거절</b>했다. 이제는 돈을 내면
 * 계속 만들 수 있다. 상한의 뜻이 "오늘은 끝" 에서 "공짜로 몇 장" 으로 바뀌었다.
 *
 * <p>⚠️ 이 시험이 지키는 것 중 제일 중요한 것은 <b>두 번 태우지 않는가</b>와
 * <b>실패하면 돌려주는가</b>다. 둘 다 돈이 걸려 있고, 틀려도 화면에는 안 보인다.
 */
class StickerPaidCreateIntegrationTests extends PostgresIntegrationTest {

    /** 1×1 투명 PNG */
    private static final String TINY_PNG =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

    @Autowired private StickerService stickerService;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private com.teacat.server.sticker.repository.StickerJobRepository jobRepository;
    @Autowired private com.teacat.server.common.config.StickerProperties stickerProperties;

    /* 🔴 스위퍼 빈은 테스트에서 꺼져 있다(sticker.sweep-enabled=false) — 매분 도는 것이
       시험을 흔들기 때문이다. 그래서 직접 만들어 불러 쓴다 (StickerSweeperIntegrationTests 와 같은 방식). */
    private StickerJobSweeper sweeper;

    @MockitoBean private FileStorageService fileStorageService;
    /** 🔴 체인을 태우지 않는다. "무엇을 얼마에 불렀나" 만 본다 */
    @MockitoBean private CatMoneyService catMoneyService;

    @Autowired private org.springframework.transaction.PlatformTransactionManager transactionManager;
    private org.springframework.transaction.support.TransactionTemplate transactionTemplate;

    private Long userId;

    @BeforeEach
    void setUp() {
        when(fileStorageService.uploadBytes(any(), anyString(), anyString()))
                .thenReturn("sticker/sketch/" + UUID.randomUUID() + ".png");
        userId = insertFundedUser("paid-sticker@test.com", "만드는사람", 10_000L);
        sweeper = new StickerJobSweeper(jobRepository, stickerProperties, catMoneyService);
        transactionTemplate = new org.springframework.transaction.support.TransactionTemplate(transactionManager);

        /* 🔴 잔액은 **CatMoneyService.chainBalance** 로 계산된다(CatMoneyHoldService.availableBalance).
           그 서비스를 목으로 갈아끼웠으므로 여기서 직접 답을 준다 — insertFundedUser 가 목으로 준
           것은 그 아래의 catMoneyClient 라서 여기까지 닿지 않는다. */
        when(catMoneyService.chainBalance(userId)).thenReturn(10_000L);
        when(catMoneyService.pendingBurns(userId)).thenReturn(0L);
    }

    private void create() {
        stickerService.create(userId, new StickerCreateRequest(TINY_PNG, null, null, null),
                UUID.randomUUID().toString());
    }

    /** 오늘 몫을 미리 채운다 — 다섯 번 부르는 대신 DB 에 바로 꽂는다 */
    private void fillTodayQuota(int count) {
        for (int i = 0; i < count; i++) {
            jdbcTemplate.update("""
                    INSERT INTO sticker_jobs (user_id, status, idempotency_key, sketch_key, seed)
                    VALUES (?, 'DONE', ?, 'sticker/sketch/a.png', 1)
                    """, userId, UUID.randomUUID().toString());
        }
    }

    @Test
    @DisplayName("하루 몫 안에서는 캣머니를 안 태운다")
    void freeWithinDailyLimit() {
        create();

        verify(catMoneyService, never()).burn(any(), any(), any(), anyString());
    }

    @Test
    @DisplayName("하루 몫을 넘기면 100 캣머니를 태운다")
    void burnsWhenOverDailyLimit() {
        fillTodayQuota(5);

        create();

        verify(catMoneyService).burn(eq(userId), eq(BigInteger.valueOf(100)),
                eq(CatTxReason.STICKER_CREATE), anyString());
    }

    @Test
    @DisplayName("유료로 만든 건은 낸 금액이 남는다 — 실패하면 그만큼 돌려줘야 한다")
    void recordsPaidAmount() {
        fillTodayQuota(5);

        create();

        Integer paid = jdbcTemplate.queryForObject(
                "SELECT paid_cat FROM sticker_jobs WHERE status = 'PENDING' AND user_id = ?",
                Integer.class, userId);
        assertThat(paid).isEqualTo(100);
    }

    @Test
    @DisplayName("잔액이 모자라면 만들지 않는다")
    void rejectsWhenNotEnoughCat() {
        Long poor = insertFundedUser("poor@test.com", "잔액없는사람", 0L);
        when(catMoneyService.chainBalance(poor)).thenReturn(0L);
        when(catMoneyService.pendingBurns(poor)).thenReturn(0L);
        for (int i = 0; i < 5; i++) {
            jdbcTemplate.update("""
                    INSERT INTO sticker_jobs (user_id, status, idempotency_key, sketch_key, seed)
                    VALUES (?, 'DONE', ?, 'sticker/sketch/a.png', 1)
                    """, poor, UUID.randomUUID().toString());
        }

        assertThatThrownBy(() -> stickerService.create(poor,
                new StickerCreateRequest(TINY_PNG, null, null, null), UUID.randomUUID().toString()))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(StickerErrorCode.NOT_ENOUGH_CAT));

        // 🔴 거절이 업로드보다 먼저 — MinIO 에 쓰레기를 안 남긴다
        verify(fileStorageService, never()).uploadBytes(any(), anyString(), anyString());
    }

    @Test
    @DisplayName("🔴 같은 요청을 두 번 보내도 두 번 태우지 않는다")
    void doesNotChargeTwiceForSameKey() {
        fillTodayQuota(5);
        String key = UUID.randomUUID().toString();
        StickerCreateRequest request = new StickerCreateRequest(TINY_PNG, null, null, null);

        stickerService.create(userId, request, key);
        stickerService.create(userId, request, key);

        /* 두 번째는 멱등키로 기존 작업을 돌려주고 끝난다 — burn 까지 가지 않는다.
           설령 갔더라도 CatMoneyService 가 같은 원장 키를 알아보고 막는다(이중 방어). */
        verify(catMoneyService).burn(any(), any(), any(), anyString());
    }

    @Test
    @DisplayName("🔴 실패한 유료 건은 캣머니를 돌려준다")
    void refundsFailedPaidJob() {
        fillTodayQuota(5);
        create();
        jdbcTemplate.update(
                "UPDATE sticker_jobs SET status = 'FAILED' WHERE status = 'PENDING' AND user_id = ?", userId);

        transactionTemplate.executeWithoutResult(status -> sweeper.sweep());

        verify(catMoneyService).mint(eq(userId), eq(BigInteger.valueOf(100)),
                eq(CatTxReason.REFUND), anyString());
    }

    @Test
    @DisplayName("🔴 환불은 두 번 돌지 않는다")
    void refundsOnlyOnce() {
        fillTodayQuota(5);
        create();
        jdbcTemplate.update(
                "UPDATE sticker_jobs SET status = 'FAILED' WHERE status = 'PENDING' AND user_id = ?", userId);

        transactionTemplate.executeWithoutResult(status -> sweeper.sweep());
        transactionTemplate.executeWithoutResult(status -> sweeper.sweep());

        // 표시가 없으면 스위퍼가 돌 때마다 또 돌려준다 — refunded_at 이 그걸 막는다
        verify(catMoneyService).mint(any(), any(), eq(CatTxReason.REFUND), anyString());
    }

    @Test
    @DisplayName("무료로 만든 건은 실패해도 돌려줄 것이 없다")
    void noRefundForFreeJob() {
        create();
        jdbcTemplate.update(
                "UPDATE sticker_jobs SET status = 'FAILED' WHERE status = 'PENDING' AND user_id = ?", userId);

        transactionTemplate.executeWithoutResult(status -> sweeper.sweep());

        verify(catMoneyService, never()).mint(any(), any(), eq(CatTxReason.REFUND), anyString());
    }
}
