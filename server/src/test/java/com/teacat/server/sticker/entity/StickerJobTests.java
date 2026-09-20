package com.teacat.server.sticker.entity;

import com.teacat.server.user.entity.User;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 작업의 상태 전이.
 *
 * <p>전이를 서비스 여기저기에 흩어 놓으면 경로마다 규칙이 갈린다 — 워커가 부르는 길과
 * 스위퍼가 부르는 길이 같은 작업을 다르게 끝내면 화면이 설명할 수 없는 상태로 남는다.
 * 그래서 엔티티에 가두고 여기서 못 박는다.
 */
class StickerJobTests {

    private static StickerJob job() {
        User user = User.create("sticker@test.com", "encoded", "테스트", "닉네임", "010-0000-0000");
        return StickerJob.pending(user, "key", "sticker/sketch/a.png", "고양이", 42);
    }

    @Test
    void 만들어지면_PENDING_이고_재시도는_0_이다() {
        StickerJob job = job();

        assertThat(job.getStatus()).isEqualTo(StickerJobStatus.PENDING);
        assertThat(job.getRetryCount()).isZero();
        assertThat(job.getFinishedAt()).isNull();
        assertThat(job.isRunning()).isFalse();
        assertThat(job.isDone()).isFalse();
    }

    @Test
    void 완료하면_DONE_이_되고_끝난_시각이_남는다() {
        StickerJob job = job();

        job.complete();

        assertThat(job.getStatus()).isEqualTo(StickerJobStatus.DONE);
        assertThat(job.isDone()).isTrue();
        assertThat(job.getFinishedAt()).isNotNull();
    }

    @Test
    void 실패하면_FAILED_가_되고_사유가_남는다() {
        StickerJob job = job();

        job.fail(StickerFailReason.WORKER_ERROR);

        assertThat(job.getStatus()).isEqualTo(StickerJobStatus.FAILED);
        assertThat(job.getFailReason()).isEqualTo(StickerFailReason.WORKER_ERROR);
        assertThat(job.getFinishedAt()).isNotNull();
    }

    /** 🔴 컬럼이 VARCHAR(40) 이다. 넘치면 저장이 통째로 터진다 */
    @Test
    void 긴_사유는_컬럼_길이에_맞춰_잘린다() {
        StickerJob job = job();
        String tooLong = "가".repeat(100);

        job.fail(tooLong);

        assertThat(job.getFailReason()).hasSize(StickerFailReason.MAX_LENGTH);
    }

    @Test
    void 빈_사유는_기본값으로_바뀐다() {
        StickerJob job = job();

        job.fail("   ");

        assertThat(job.getFailReason()).isEqualTo(StickerFailReason.WORKER_ERROR);
    }

    @Test
    void 사유가_null_이어도_저장할_값을_만든다() {
        StickerJob job = job();

        job.fail(null);

        assertThat(job.getFailReason()).isEqualTo(StickerFailReason.WORKER_ERROR);
    }
}
