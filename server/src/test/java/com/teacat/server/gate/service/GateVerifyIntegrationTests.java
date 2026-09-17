package com.teacat.server.gate.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.gate.dto.request.GateVerifyRequest;
import com.teacat.server.gate.dto.response.GateDecision;
import com.teacat.server.gate.dto.response.GateSessionResponse;
import com.teacat.server.gate.dto.response.GateVerifyResponse;
import com.teacat.server.gate.entity.AdmissionMethod;
import com.teacat.server.gate.exception.GateErrorCode;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.ticket.exception.TicketErrorCode;
import com.teacat.server.user.entity.Face;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 현장 검표 (GATE_PLAN.md).
 *
 * <p><b>임계값을 여기서 고정한다.</b> application.yaml 의 값은 실측하며 계속 바뀔 예정이라
 * (8-3) 거기에 기대면 튜닝할 때마다 이 테스트가 깨진다. 지키려는 건 특정 숫자가 아니라
 * <b>판정 규칙</b>이다 — 점수가 충분하고 2등과 벌어져 있으면 통과, 붙어 있으면 보류.
 *
 * <p>얼굴 벡터는 실제 얼굴에서 뽑지 않고 <b>원하는 유사도가 나오도록 만들어</b> 쓴다
 * ({@link #personAt}). 저장소에 얼굴 사진을 넣지 않기 위해서이기도 하고, 경계 조건을
 * 정확히 겨눌 수 있어서이기도 하다.
 */
@TestPropertySource(properties = {
        "gate.enabled=true",
        "gate.threshold.match=0.70",
        "gate.threshold.review=0.55",
        "gate.threshold.margin=0.05"
})
class GateVerifyIntegrationTests extends PostgresIntegrationTest {

    private static final String MODEL = "test-sface-v1";

    @Autowired private GateVerifyService gateVerifyService;
    @Autowired private GateAdmissionService gateAdmissionService;

    /** 예매자 이메일과 좌석 번호를 겹치지 않게 만드는 일련번호. 테스트마다 초기화된다 */
    private int nextSerial = 1;

    @Test
    void 확실히_같은_사람이면_통과시키고_입장_기록을_남긴다() {
        Long adminId = insertUser("gate-admin@test.com", "운영자", "ADMIN");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(fixture, personAt(0.82), MODEL);
        insertTicketWithFace(fixture, personAt(0.30), MODEL);

        GateVerifyResponse result = verify(adminId, fixture, probe());

        assertThat(result.decision()).isEqualTo(GateDecision.MATCH);
        assertThat(result.ticket().ticketId()).isEqualTo(ticketId);
        assertThat(result.candidateCount()).isEqualTo(2);
        // 🔴 판정과 함께 **입장까지 끝나 있어야** 한다. 응답에 시각이 있는데 행이 없으면 거짓말이다
        assertThat(result.admittedAt()).isNotNull();
        assertThat(admissionMethodOf(ticketId)).isEqualTo("FACE");
    }

    @Test
    void 일등과_이등이_붙어_있으면_통과시키지_않고_보류한다() {
        Long adminId = insertUser("gate-admin@test.com", "운영자", "ADMIN");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(fixture, personAt(0.82), MODEL);
        insertTicketWithFace(fixture, personAt(0.80), MODEL);

        GateVerifyResponse result = verify(adminId, fixture, probe());

        /* 점수(0.82)는 통과선을 넘었지만 2등(0.80)과 0.02 밖에 안 벌어졌다. 둘 중 누구인지
           모르는 상태라 들여보내면 안 된다 — 이 검사가 없으면 1등을 그냥 통과시킨다. */
        assertThat(result.decision()).isEqualTo(GateDecision.REVIEW);
        assertThat(result.ticket().ticketId()).isEqualTo(ticketId);
        assertThat(admissionRows(ticketId)).isZero();
    }

    @Test
    void 애매한_점수는_거절하지_않고_운영자에게_넘긴다() {
        Long adminId = insertUser("gate-admin@test.com", "운영자", "ADMIN");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(fixture, personAt(0.62), MODEL);

        GateVerifyResponse result = verify(adminId, fixture, probe());

        assertThat(result.decision()).isEqualTo(GateDecision.REVIEW);
        assertThat(result.ticket().ticketId()).isEqualTo(ticketId);
        // 후보가 하나뿐이면 2등이 없다. 마진 때문에 영영 보류되면 안 되므로 점수만으로 갈린다
        assertThat(result.runnerUp()).isNull();
    }

    @Test
    void 안_닮았으면_가장_가까웠던_티켓이_누구인지_알려주지_않는다() {
        Long adminId = insertUser("gate-admin@test.com", "운영자", "ADMIN");
        Fixture fixture = insertPerformanceFixture();
        insertTicketWithFace(fixture, personAt(0.20), MODEL);

        GateVerifyResponse result = verify(adminId, fixture, probe());

        assertThat(result.decision()).isEqualTo(GateDecision.NO_MATCH);
        /* 🔴 남의 얼굴로 여러 번 찍으며 그 회차에 누가 오는지 훑어볼 수 있게 된다.
           점수도 주지 않는다 — 어느 방향이 더 가까운지 더듬는 단서가 된다. */
        assertThat(result.ticket()).isNull();
        assertThat(result.similarity()).isNull();
    }

    @Test
    void 흔들린_프레임이_섞여도_좋은_프레임_하나면_통과한다() {
        Long adminId = insertUser("gate-admin@test.com", "운영자", "ADMIN");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(fixture, personAt(0.82), MODEL);

        /* best-of-N 이 하는 일이 이것이다. 앞의 둘만 보냈다면 거절당했을 사람이,
           잘 나온 한 장 덕분에 통과한다 — 얼굴이 움직여 벡터가 흩어지는 만큼을 여기서 흡수한다. */
        GateVerifyResponse result = verify(adminId, fixture,
                personAt(0.10), personAt(0.35), probe());

        assertThat(result.decision()).isEqualTo(GateDecision.MATCH);
        assertThat(result.ticket().ticketId()).isEqualTo(ticketId);
    }

    @Test
    void 기본_얼굴의_모델_버전으로는_대조하지_않는다() {
        Long adminId = insertUser("gate-admin@test.com", "운영자", "ADMIN");
        Fixture fixture = insertPerformanceFixture();
        insertTicketWithFace(fixture, personAt(0.82), Face.DEFAULT_MODEL_VERSION);

        /* 🔴 기본 얼굴은 모든 계정이 같은 균일 벡터를 갖는다. 그 값과 그 모델 버전을 함께
           보내면 아직 실제 얼굴을 등록하지 않은 티켓 **전부**와 1.0 으로 붙는다 —
           그 자체가 만능 열쇠다. 대조를 시도하기 전에 막아야 한다. */
        assertThatThrownBy(() -> gateVerifyService.verify(adminId, fixture.performanceDetailId(),
                new GateVerifyRequest(List.of(probe()), Face.DEFAULT_MODEL_VERSION)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(GateErrorCode.FACE_MODEL_NOT_ALLOWED);
    }

    @Test
    void 기본_얼굴_티켓은_후보에_들어오지_않는다() {
        Long adminId = insertUser("gate-admin@test.com", "운영자", "ADMIN");
        Fixture fixture = insertPerformanceFixture();
        insertTicketWithFace(fixture, personAt(0.99), Face.DEFAULT_MODEL_VERSION);

        GateVerifyResponse result = verify(adminId, fixture, probe());

        /* 지금 발권된 티켓이 전부 이 상태다. 게이트를 붙여도 운영이 안 바뀌는 근거이고
           (GATE_PLAN.md 2-2), 모델 버전이 다르면 대조가 성립하지 않는다는 규칙이기도 하다. */
        assertThat(result.decision()).isEqualTo(GateDecision.NO_MATCH);
        assertThat(result.candidateCount()).isZero();
    }

    @Test
    void 다른_회차의_티켓은_후보가_아니다() {
        Long adminId = insertUser("gate-admin@test.com", "운영자", "ADMIN");
        Fixture today = insertPerformanceFixture();
        Fixture tomorrow = insertPerformanceFixture();
        insertTicketWithFace(tomorrow, personAt(0.99), MODEL);

        GateVerifyResponse result = verify(adminId, today, probe());

        // 게이트 기기가 다른 회차 관객을 들여보내면 안 된다. 스코프가 곧 안전장치다
        assertThat(result.decision()).isEqualTo(GateDecision.NO_MATCH);
        assertThat(result.candidateCount()).isZero();
    }

    @Test
    void 취소된_예매는_얼굴이_맞아도_들여보내지_않는다() {
        Long adminId = insertUser("gate-admin@test.com", "운영자", "ADMIN");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(fixture, personAt(0.99), MODEL);
        jdbcTemplate.update("UPDATE tickets SET status = 'CANCELLED' WHERE id = ?", ticketId);

        assertThat(verify(adminId, fixture, probe()).decision()).isEqualTo(GateDecision.NO_MATCH);

        // 수동 통과로도 못 들어간다 — 후보에서 빠지는 것과 별개로 막아야 한다
        assertThatThrownBy(() -> gateAdmissionService.admit(ticketId, adminId, AdmissionMethod.MANUAL))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(GateErrorCode.TICKET_NOT_ADMITTABLE);
    }

    @Test
    void 이미_입장한_티켓은_후보에서_빠진다() {
        Long adminId = insertUser("gate-admin@test.com", "운영자", "ADMIN");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(fixture, personAt(0.82), MODEL);

        assertThat(verify(adminId, fixture, probe()).decision()).isEqualTo(GateDecision.MATCH);

        /* 빼지 않으면 먼저 들어간 사람이 계속 1등으로 잡혀, 뒤에 온 진짜 관객이
           "이미 입장함" 으로 막힌다. 그래서 후보 쿼리가 NOT EXISTS 로 거른다. */
        GateVerifyResponse again = verify(adminId, fixture, probe());
        assertThat(again.decision()).isEqualTo(GateDecision.NO_MATCH);
        assertThat(again.candidateCount()).isZero();
        assertThat(admissionRows(ticketId)).isOne();
    }

    @Test
    void 같은_티켓을_두_번_통과시킬_수_없다() {
        Long adminId = insertUser("gate-admin@test.com", "운영자", "ADMIN");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(fixture, personAt(0.82), MODEL);

        gateAdmissionService.admit(ticketId, adminId, AdmissionMethod.MANUAL);

        assertThatThrownBy(() -> gateAdmissionService.admit(ticketId, adminId, AdmissionMethod.MANUAL))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(GateErrorCode.ALREADY_ADMITTED);

        assertThat(admissionRows(ticketId)).isOne();
    }

    @Test
    void 입장을_취소하면_다시_검표할_수_있다() {
        Long adminId = insertUser("gate-admin@test.com", "운영자", "ADMIN");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(fixture, personAt(0.82), MODEL);
        gateAdmissionService.admit(ticketId, adminId, AdmissionMethod.MANUAL);

        gateAdmissionService.cancel(ticketId);

        /* 오인 입장 한 건에 진짜 관객이 영구히 막히면 안 된다 — 이미 입장한 티켓은
           후보에서 빠지기 때문에, 되돌릴 길이 없으면 그 사람은 영영 못 들어간다. */
        assertThat(admissionRows(ticketId)).isZero();
        assertThat(verify(adminId, fixture, probe()).decision()).isEqualTo(GateDecision.MATCH);
    }

    @Test
    void 없는_입장_기록은_취소할_수_없다() {
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(fixture, personAt(0.82), MODEL);

        assertThatThrownBy(() -> gateAdmissionService.cancel(ticketId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(GateErrorCode.ADMISSION_NOT_FOUND);
    }

    @Test
    void 없는_티켓은_통과시킬_수_없다() {
        Long adminId = insertUser("gate-admin@test.com", "운영자", "ADMIN");

        assertThatThrownBy(() -> gateAdmissionService.admit(999_999L, adminId, AdmissionMethod.MANUAL))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(TicketErrorCode.TICKET_NOT_FOUND);
    }

    @Test
    void 차원이_다른_임베딩은_DB_까지_가기_전에_거절한다() {
        Long adminId = insertUser("gate-admin@test.com", "운영자", "ADMIN");
        Fixture fixture = insertPerformanceFixture();

        /* 여기서 안 막으면 pgvector 가 SQL 단에서 터지는데, 그 에러 메시지에는
           **임베딩 값이 그대로 실린다** — 그게 로그로, 이어서 Sentry 로 나간다. */
        assertThatThrownBy(() -> gateVerifyService.verify(adminId, fixture.performanceDetailId(),
                new GateVerifyRequest(List.of(new float[64]), MODEL)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(GateErrorCode.INVALID_EMBEDDING);
    }

    @Test
    void 회차_현황은_대조할_수_있는_티켓이_몇_장인지_알려준다() {
        Long adminId = insertUser("gate-admin@test.com", "운영자", "ADMIN");
        Fixture fixture = insertPerformanceFixture();
        Long enrolled = insertTicketWithFace(fixture, personAt(0.82), MODEL);
        insertTicketWithFace(fixture, personAt(0.40), Face.DEFAULT_MODEL_VERSION);
        gateAdmissionService.admit(enrolled, adminId, AdmissionMethod.MANUAL);

        GateSessionResponse session = gateVerifyService.getSession(fixture.performanceDetailId());

        assertThat(session.totalTickets()).isEqualTo(2);
        /* 🔴 이 값이 0 이면 화면은 카메라를 아예 켜지 말아야 한다. 지금 운영 데이터가
           정확히 그 상태다 — 말해 주지 않으면 운영자가 한참 찍다가 알게 된다. */
        assertThat(session.faceEnrolledTickets()).isOne();
        assertThat(session.admittedCount()).isOne();
    }

    // ── 도우미 ─────────────────────────────────────────────────────

    private GateVerifyResponse verify(Long adminId, Fixture fixture, float[]... probes) {
        return gateVerifyService.verify(adminId, fixture.performanceDetailId(),
                new GateVerifyRequest(List.of(probes), MODEL));
    }

    /**
     * 검표대에서 찍은 얼굴. {@link #personAt} 이 만드는 벡터의 기준축이다.
     *
     * <p>{@code personAt(s)} 와의 코사인 유사도가 정확히 {@code s} 가 되도록 짜여 있어서,
     * 경계 조건(0.70 · 0.55 · 마진 0.05)을 어림하지 않고 정확히 겨눌 수 있다.
     */
    private static float[] probe() {
        return axis(true);
    }

    /**
     * {@link #probe()} 와의 유사도가 정확히 {@code similarity} 인 얼굴.
     *
     * <p>서로 직교하는 두 축 {@code a}·{@code b} 를 {@code a·s + b·√(1-s²)} 로 섞는다.
     * 둘 다 단위벡터이고 직교하므로 결과도 단위벡터이며, {@code a} 와의 내적이 정확히
     * {@code s} 다. 실제 임베딩도 L2 정규화돼 들어오므로 같은 성질을 갖는다.
     */
    private static float[] personAt(double similarity) {
        float[] a = axis(true);
        float[] b = axis(false);
        float[] mixed = new float[Face.EMBEDDING_DIMENSION];

        double orthogonal = Math.sqrt(1 - similarity * similarity);
        for (int i = 0; i < mixed.length; i++) {
            mixed[i] = (float) (a[i] * similarity + b[i] * orthogonal);
        }

        return mixed;
    }

    /** 앞 절반만 채운 축과 뒤 절반만 채운 축. 겹치는 성분이 없어 서로 직교한다 */
    private static float[] axis(boolean firstHalf) {
        int half = Face.EMBEDDING_DIMENSION / 2;
        float value = (float) (1 / Math.sqrt(half));
        float[] vector = new float[Face.EMBEDDING_DIMENSION];

        for (int i = 0; i < half; i++) {
            vector[firstHalf ? i : half + i] = value;
        }

        return vector;
    }

    /**
     * 얼굴을 직접 지정한 티켓 한 장.
     *
     * <p>예매자는 티켓마다 새로 만든다 — 한 회차에 같은 사람이 여러 장을 갖는 상황을
     * 만들지 않기 위해서다. 좌석 번호와 이메일은 테스트 안에서만 유일하면 되므로
     * 카운터 하나로 둘 다 만든다 (회차가 둘이면 좌석 수로는 겹친다).
     */
    private Long insertTicketWithFace(Fixture fixture, float[] embedding, String modelVersion) {
        int serial = nextSerial++;
        Long userId = insertUser("holder-" + serial + "@test.com", "예매자 " + serial);
        Long seatId = jdbcTemplate.queryForObject("""
                INSERT INTO seats (area_id, row_label, seat_number)
                VALUES (?, '3', ?) RETURNING id
                """, Long.class, fixture.areaId(), serial);

        return jdbcTemplate.queryForObject("""
                INSERT INTO tickets (user_id, performance_detail_id, area_id, seat_id,
                                     status, face_embedding, face_model_version)
                VALUES (?, ?, ?, ?, 'CONFIRMED', ?::vector, ?) RETURNING id
                """, Long.class, userId, fixture.performanceDetailId(), fixture.areaId(), seatId,
                toVectorLiteral(embedding), modelVersion);
    }

    private static String toVectorLiteral(float[] embedding) {
        StringBuilder literal = new StringBuilder("[");
        for (int i = 0; i < embedding.length; i++) {
            if (i > 0) {
                literal.append(',');
            }
            literal.append(embedding[i]);
        }
        return literal.append(']').toString();
    }

    private int admissionRows(Long ticketId) {
        return jdbcTemplate.queryForObject(
                "SELECT count(*)::int FROM admissions WHERE ticket_id = ?", Integer.class, ticketId);
    }

    private String admissionMethodOf(Long ticketId) {
        return jdbcTemplate.queryForObject(
                "SELECT method::text FROM admissions WHERE ticket_id = ?", String.class, ticketId);
    }
}
