package com.teacat.server.user.service;

import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * 예매한 회원의 얼굴 삭제·탈퇴.
 *
 * <p>🔴 <b>예전에는 둘 다 막혀 있었다.</b> {@code tickets.face_id} 가 {@code faces} 를 외래키로
 * 붙잡고 있어서, 얼굴을 지우려 하면 운영에서 이렇게 터졌다:
 *
 * <pre>
 * update or delete on table "faces" violates foreign key constraint
 * "fk_tickets_face" on table "tickets"
 * </pre>
 *
 * <p>예매를 한 번이라도 한 회원은 얼굴 삭제도, <b>탈퇴도</b> 못 했다(탈퇴가 내부에서 얼굴을
 * 지운다). 티켓이 얼굴을 가리키는 대신 <b>베껴 두도록</b> 바꿔서 풀었다
 * ({@code V20260915_1000__copy_face_into_tickets.sql}).
 *
 * <p>이 테스트가 지키는 것은 두 가지다 — <b>지워지는가</b>, 그리고 <b>티켓이 무사한가</b>.
 */
class FaceDeletionIntegrationTests extends PostgresIntegrationTest {

    @Autowired private UserService userService;

    @Test
    void 예매한_회원도_얼굴을_지울_수_있고_티켓은_그대로다() {
        Long userId = insertUser("face-delete@test.com", "얼굴삭제");
        Long faceId = insertFace();
        jdbcTemplate.update("UPDATE users SET face_id = ? WHERE id = ?", faceId, userId);
        Long ticketId = insertTicket(userId, insertPerformanceFixture());

        assertThatCode(() -> userService.deleteFace(userId)).doesNotThrowAnyException();

        // 얼굴은 정말 사라졌다 (연결만 끊긴 게 아니라 행까지)
        assertThat(faceRows(faceId)).isZero();
        assertThat(userFaceId(userId)).isNull();

        /* 🔴 티켓은 아무 영향이 없다 — 예매 당시 얼굴을 **베껴** 갖고 있기 때문이다.
           여기가 깨지면 "얼굴을 지우면 발권 기록이 날아간다" 는 뜻이라 훨씬 나쁘다 */
        assertThat(ticketEmbeddingExists(ticketId)).isTrue();
    }

    @Test
    void 예매한_회원도_탈퇴할_수_있다() {
        Long userId = insertUser("withdraw@test.com", "탈퇴회원");
        Long faceId = insertFace();
        jdbcTemplate.update("UPDATE users SET face_id = ? WHERE id = ?", faceId, userId);
        Long ticketId = insertTicket(userId, insertPerformanceFixture());

        assertThatCode(() -> userService.withdraw(userId)).doesNotThrowAnyException();

        // 탈퇴는 소프트 삭제지만 생체정보(faces)는 즉시 파기한다
        assertThat(faceRows(faceId)).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT deleted_at IS NOT NULL FROM users WHERE id = ?", Boolean.class, userId))
                .isTrue();

        /* ⚠️ 티켓의 복사본은 **남는다** (사용자 결정, server/CLAUDE.md 6장).
           파기 범위를 따질 때 faces 만 보면 안 된다는 뜻이라, 사실로 고정해 둔다 */
        assertThat(ticketEmbeddingExists(ticketId)).isTrue();
    }

    private int faceRows(Long faceId) {
        return jdbcTemplate.queryForObject(
                "SELECT count(*)::int FROM faces WHERE id = ?", Integer.class, faceId);
    }

    private Long userFaceId(Long userId) {
        return jdbcTemplate.queryForObject(
                "SELECT face_id FROM users WHERE id = ?", Long.class, userId);
    }

    private boolean ticketEmbeddingExists(Long ticketId) {
        return jdbcTemplate.queryForObject(
                "SELECT face_embedding IS NOT NULL FROM tickets WHERE id = ?", Boolean.class, ticketId);
    }
}
