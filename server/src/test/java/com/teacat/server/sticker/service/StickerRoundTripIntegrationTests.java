package com.teacat.server.sticker.service;

import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.sticker.dto.request.StickerCreateRequest;
import com.teacat.server.sticker.dto.request.StickerJobCompleteRequest;
import com.teacat.server.sticker.dto.request.StickerJobFailRequest;
import com.teacat.server.sticker.dto.response.StickerJobClaimResponse;
import com.teacat.server.sticker.dto.response.StickerJobResponse;
import com.teacat.server.sticker.entity.StickerFailReason;
import com.teacat.server.sticker.entity.StickerJobStatus;
import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Base64;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

/**
 * 낙서를 올려서 스티커를 받기까지 — 사용자와 워커가 번갈아 부르는 전체 흐름.
 *
 * <p>구현 계획 6번의 {@code curl} 왕복을 코드로 옮긴 것이다. 조각마다 테스트가 있어도
 * <b>이어 붙였을 때</b> 프론트가 기다리는 모양이 나오는지는 따로 봐야 한다.
 */
class StickerRoundTripIntegrationTests extends PostgresIntegrationTest {

    private static final byte[] SKETCH = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};
    private static final byte[] RESULT = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 9, 9, 9};

    @Autowired
    private StickerService stickerService;

    @Autowired
    private StickerJobWorkerService workerService;

    @MockitoBean
    private FileStorageService fileStorageService;

    private Long userId;

    @BeforeEach
    void setUp() {
        given(fileStorageService.uploadBytes(any(), any(), any())).willReturn("sticker/result/a.png");
        given(fileStorageService.download(anyString())).willReturn(SKETCH);
        given(fileStorageService.presignedUrl(anyString())).willReturn("https://minio.test/a.png");
        userId = insertUser("roundtrip@test.com", "왕복");
    }

    private static StickerCreateRequest sketch() {
        return new StickerCreateRequest(Base64.getEncoder().encodeToString(SKETCH), "고양이", 777, null);
    }

    @Test
    void 낙서를_올리고_워커가_그리면_스티커가_나온다() {
        Long jobId = stickerService.create(userId, sketch(), UUID.randomUUID().toString()).jobId();

        // 아직 아무도 안 집어갔다 — 화면은 "그리고 있어요"
        StickerJobResponse pending = stickerService.job(userId, jobId);
        assertThat(pending.status()).isEqualTo(StickerJobStatus.PENDING);
        assertThat(pending.sticker()).isNull();
        assertThat(pending.failReason()).isNull();

        // 워커가 집어간다. 🔴 주제와 시드가 함께 가야 "주제" 와 "다시 만들기" 가 의미를 갖는다
        StickerJobClaimResponse claimed = workerService.claimNext("gpu-01").orElseThrow();
        assertThat(claimed.jobId()).isEqualTo(jobId);
        assertThat(claimed.subject()).isEqualTo("고양이");
        assertThat(claimed.seed()).isEqualTo(777);

        assertThat(stickerService.job(userId, jobId).status()).isEqualTo(StickerJobStatus.RUNNING);

        // 결과가 올라온다
        workerService.complete(jobId, new StickerJobCompleteRequest(
                Base64.getEncoder().encodeToString(RESULT), Map.of("seed", 777, "secs", 7)));

        StickerJobResponse done = stickerService.job(userId, jobId);
        assertThat(done.status()).isEqualTo(StickerJobStatus.DONE);
        assertThat(done.sticker()).isNotNull();
        assertThat(done.sticker().imageUrl()).isEqualTo("https://minio.test/a.png");
        assertThat(done.failReason()).isNull();

        // 내 목록에도 바로 보인다 — 따로 "저장" 요청이 없다
        assertThat(stickerService.mine(userId)).hasSize(1);
        assertThat(stickerService.mine(userId).get(0).id()).isEqualTo(done.sticker().id());
    }

    @Test
    void 워커가_실패를_신고하면_사유가_함께_내려가고_오늘_몫이_돌아온다() {
        Long jobId = stickerService.create(userId, sketch(), UUID.randomUUID().toString()).jobId();
        assertThat(stickerService.quota(userId).used()).isEqualTo(1);

        workerService.claimNext("gpu-01").orElseThrow();
        workerService.fail(jobId, new StickerJobFailRequest("CUDA out of memory"));

        StickerJobResponse failed = stickerService.job(userId, jobId);
        assertThat(failed.status()).isEqualTo(StickerJobStatus.FAILED);
        assertThat(failed.failReason()).isEqualTo(StickerFailReason.WORKER_ERROR);
        assertThat(failed.sticker()).isNull();

        // 워커 장애로 사용자 몫이 깎이면 안 된다
        assertThat(stickerService.quota(userId).used()).isZero();
    }

    /** "다시 만들기" — 같은 낙서, 다른 시드. 멱등키가 다르므로 새 작업이다 */
    @Test
    void 다시_만들면_새_작업이_서고_시드가_다르다() {
        Long first = stickerService.create(userId,
                new StickerCreateRequest(Base64.getEncoder().encodeToString(SKETCH), null, 1, null),
                UUID.randomUUID().toString()).jobId();
        Long second = stickerService.create(userId,
                new StickerCreateRequest(Base64.getEncoder().encodeToString(SKETCH), null, 2, null),
                UUID.randomUUID().toString()).jobId();

        assertThat(second).isNotEqualTo(first);

        assertThat(workerService.claimNext("gpu-01").orElseThrow().seed()).isEqualTo(1);
        assertThat(workerService.claimNext("gpu-01").orElseThrow().seed()).isEqualTo(2);
    }
}
