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
    @Autowired private AdminUserService adminUserService;

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

    /**
     * 🔴 <b>탈퇴는 티켓의 복사본까지 지운다.</b> faces 행만 지우면 파기가 반쪽이다 —
     * 예매 건수만큼 임베딩이 남고, 그건 "탈퇴 시 즉시 파기" 라는 고지와 다르다.
     */
    @Test
    void 탈퇴하면_티켓에_베껴_둔_얼굴까지_지운다() {
        Long userId = insertUser("withdraw@test.com", "탈퇴회원");
        Long faceId = insertFace();
        jdbcTemplate.update("UPDATE users SET face_id = ? WHERE id = ?", faceId, userId);
        Long ticketId = insertTicket(userId, insertPerformanceFixture());

        assertThatCode(() -> userService.withdraw(userId)).doesNotThrowAnyException();

        assertThat(faceRows(faceId)).isZero();
        assertThat(ticketEmbeddingExists(ticketId)).isFalse();
        assertThat(ticketModelVersion(ticketId)).isNull();

        // 탈퇴 자체는 소프트 삭제다 — 발권 이력(티켓 행)은 남는다
        assertThat(jdbcTemplate.queryForObject(
                "SELECT deleted_at IS NOT NULL FROM users WHERE id = ?", Boolean.class, userId))
                .isTrue();
        assertThat(ticketRows(ticketId)).isEqualTo(1);
    }

    /**
     * 🔴 탈퇴 경로가 <b>둘</b>이라 따로 지킨다. 한쪽만 고치면 관리자가 내린 탈퇴에서만
     * 생체정보가 남고, 그건 눈에 띄지 않는다.
     */
    @Test
    void 관리자가_탈퇴시켜도_티켓의_얼굴까지_지운다() {
        Long adminId = insertUser("admin-withdraw@test.com", "관리자", "ADMIN");
        Long userId = insertUser("victim@test.com", "대상회원");
        Long faceId = insertFace();
        jdbcTemplate.update("UPDATE users SET face_id = ? WHERE id = ?", faceId, userId);
        Long ticketId = insertTicket(userId, insertPerformanceFixture());

        assertThatCode(() -> adminUserService.withdraw(adminId, userId)).doesNotThrowAnyException();

        assertThat(faceRows(faceId)).isZero();
        assertThat(ticketEmbeddingExists(ticketId)).isFalse();
    }

    /** 예매가 없는 회원도 그냥 탈퇴된다 (지울 티켓이 0건이어도 정상) */
    @Test
    void 예매가_없는_회원도_탈퇴된다() {
        Long userId = insertUser("no-ticket@test.com", "무예매");
        jdbcTemplate.update("UPDATE users SET face_id = ? WHERE id = ?", insertFace(), userId);

        assertThatCode(() -> userService.withdraw(userId)).doesNotThrowAnyException();
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

    private String ticketModelVersion(Long ticketId) {
        return jdbcTemplate.queryForObject(
                "SELECT face_model_version FROM tickets WHERE id = ?", String.class, ticketId);
    }

    private int ticketRows(Long ticketId) {
        return jdbcTemplate.queryForObject(
                "SELECT count(*)::int FROM tickets WHERE id = ?", Integer.class, ticketId);
    }
}
