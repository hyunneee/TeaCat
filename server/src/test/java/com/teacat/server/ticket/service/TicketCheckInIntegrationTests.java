package com.teacat.server.ticket.service;

import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.user.entity.Face;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 게이트 입장 확인 — QR 로 표를 찾고, 예매 당시 얼굴과 대조하고, 입장 기록을 남긴다.
 *
 * <p>이 기능은 <b>암표를 막으려고</b> 있다. 그래서 여기서 지키는 것은 "되는가" 보다
 * <b>"안 되어야 할 것이 정말 막히는가"</b> 다 — 위조된 QR, 다른 회차, 두 번째 입장,
 * 대조할 수 없는 얼굴.
 */
class TicketCheckInIntegrationTests extends PostgresIntegrationTest {

    private static final String MODEL = "yunet2023mar+sface2021dec-int8@1";

    @Test void organizerCanOnlyScanAndVerifyOwnSchedule() throws Exception {
        Long owner = insertUser("owner@test.com", "owner", "PERFORMANCE");
        Fixture own = insertPerformanceFixture();
        Fixture other = insertPerformanceFixture();
        jdbcTemplate.update("UPDATE performance_general SET created_by = ? WHERE id = ?", owner, own.performanceId());
        Long attendee = insertUser("attendee@test.com", "attendee");
        Long ticket = insertTicketWithFace(attendee, own, personA(), MODEL);
        String auth = "Bearer " + jwtTokenProvider.createAccessToken(owner, UserRole.PERFORMANCE);
        mockMvc.perform(post("/admin/check-in/scan").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content(scanBody(qrSigner.sign(ticket), own.performanceDetailId()))).andExpect(status().isOk());
        mockMvc.perform(post("/admin/check-in/scan").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content(scanBody(qrSigner.sign(ticket), other.performanceDetailId()))).andExpect(status().isForbidden());
        mockMvc.perform(post("/admin/check-in/verify").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content(verifyBody(qrSigner.sign(ticket), other.performanceDetailId(), personA(), MODEL))).andExpect(status().isForbidden());
    }

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtTokenProvider jwtTokenProvider;
    @Autowired private TicketQrSigner qrSigner;

    @Test
    void QR_을_찍으면_누구의_어느_좌석인지_보여준다() throws Exception {
        Long userId = insertUser("gate1@test.com", "입장객");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(userId, fixture, personA(), MODEL);

        mockMvc.perform(post("/admin/check-in/scan")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(scanBody(qrSigner.sign(ticketId), fixture.performanceDetailId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ticketId").value(ticketId))
                .andExpect(jsonPath("$.data.holderNickname").value("입장객"))
                .andExpect(jsonPath("$.data.areaCode").value("A"))
                .andExpect(jsonPath("$.data.faceVerifiable").value(true))
                .andExpect(jsonPath("$.data.checkedInAt").doesNotExist());
    }

    /**
     * 🔴 <b>서명을 한 글자만 바꿔도 거절해야 한다.</b> 여기가 뚫리면 아무 번호나 QR 로 만들어
     * 남의 예매 정보(이름·좌석)를 게이트 화면에 띄울 수 있다.
     */
    @Test
    void 서명이_변조된_QR_은_거절한다() throws Exception {
        Long userId = insertUser("forged@test.com", "위조범");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(userId, fixture, personA(), MODEL);

        String token = qrSigner.sign(ticketId);
        String tampered = token.substring(0, token.length() - 1) + (token.endsWith("A") ? "B" : "A");

        mockMvc.perform(post("/admin/check-in/scan")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(scanBody(tampered, fixture.performanceDetailId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TICKET_005"));
    }

    /** 서명 없이 번호만 담은 QR 도 통하지 않는다 */
    @Test
    void 서명이_없는_QR_은_거절한다() throws Exception {
        Long userId = insertUser("plain@test.com", "맨번호");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(userId, fixture, personA(), MODEL);

        mockMvc.perform(post("/admin/check-in/scan")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(scanBody("T1." + ticketId, fixture.performanceDetailId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TICKET_005"));
    }

    /**
     * 🔴 없는 티켓도 <b>위조와 같은 오류</b>다. 구분해서 알려주면 번호를 하나씩 넣어보며
     * 존재하는 티켓을 찾아낼 수 있다.
     */
    @Test
    void 없는_티켓은_위조와_같은_오류를_낸다() throws Exception {
        Fixture fixture = insertPerformanceFixture();

        mockMvc.perform(post("/admin/check-in/scan")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(scanBody(qrSigner.sign(999999L), fixture.performanceDetailId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TICKET_005"));
    }

    @Test
    void 다른_회차의_티켓은_거절한다() throws Exception {
        Long userId = insertUser("wrongshow@test.com", "다른회차");
        Fixture mine = insertPerformanceFixture();
        Fixture other = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(userId, mine, personA(), MODEL);

        mockMvc.perform(post("/admin/check-in/scan")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(scanBody(qrSigner.sign(ticketId), other.performanceDetailId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TICKET_006"));
    }

    @Test
    void 취소된_티켓은_거절한다() throws Exception {
        Long userId = insertUser("cancelled@test.com", "취소함");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(userId, fixture, personA(), MODEL);
        jdbcTemplate.update("UPDATE tickets SET status = 'CANCELLED' WHERE id = ?", ticketId);

        mockMvc.perform(post("/admin/check-in/scan")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(scanBody(qrSigner.sign(ticketId), fixture.performanceDetailId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TICKET_007"));
    }

    @Test
    void 같은_얼굴이면_입장_처리된다() throws Exception {
        Long userId = insertUser("pass@test.com", "본인");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(userId, fixture, personA(), MODEL);

        mockMvc.perform(post("/admin/check-in/verify")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody(qrSigner.sign(ticketId), fixture.performanceDetailId(),
                                personA(), MODEL)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.match").value(true))
                .andExpect(jsonPath("$.data.checkedInAt").exists())
                .andExpect(jsonPath("$.data.embedding").doesNotExist());

        assertThat(checkedInAt(ticketId)).isNotNull();
    }

    /**
     * 🔴 <b>닮지 않았으면 입장 기록을 남기지 않는다.</b> 남기면 본인이 다시 찍을 때
     * "이미 입장함" 으로 막혀 영영 못 들어간다.
     */
    @Test
    void 다른_얼굴이면_입장_기록을_남기지_않는다() throws Exception {
        Long userId = insertUser("stranger@test.com", "남");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(userId, fixture, personA(), MODEL);

        mockMvc.perform(post("/admin/check-in/verify")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody(qrSigner.sign(ticketId), fixture.performanceDetailId(),
                                personB(), MODEL)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.match").value(false))
                .andExpect(jsonPath("$.data.checkedInAt").doesNotExist());

        assertThat(checkedInAt(ticketId)).isNull();
    }

    /** 🔴 같은 QR 로 두 명이 들어가는 것을 막는 것이 암표 방지의 마지막 고리다 */
    @Test
    void 이미_입장한_티켓은_두_번째를_막는다() throws Exception {
        Long userId = insertUser("twice@test.com", "두번째");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(userId, fixture, personA(), MODEL);
        String token = qrSigner.sign(ticketId);
        String admin = adminToken();

        mockMvc.perform(post("/admin/check-in/verify")
                        .header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody(token, fixture.performanceDetailId(), personA(), MODEL)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/admin/check-in/verify")
                        .header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody(token, fixture.performanceDetailId(), personA(), MODEL)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TICKET_008"));

        mockMvc.perform(post("/admin/check-in/scan")
                        .header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(scanBody(token, fixture.performanceDetailId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TICKET_008"));
    }

    /**
     * 🔴 가입할 때 채워 둔 <b>기본 얼굴</b>은 사람에게서 뽑은 값이 아니고 모든 계정이 같다.
     * 대조하면 아무나 통과하거나 아무도 못 통과한다 — <b>대조 자체를 거절</b>해야 한다.
     */
    @Test
    void 기본_얼굴로_예매한_티켓은_대조하지_않고_거절한다() throws Exception {
        Long userId = insertUser("bootstrap@test.com", "기본얼굴");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(userId, fixture, defaultFace(), Face.DEFAULT_MODEL_VERSION);

        mockMvc.perform(post("/admin/check-in/verify")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody(qrSigner.sign(ticketId), fixture.performanceDetailId(),
                                defaultFace(), Face.DEFAULT_MODEL_VERSION)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TICKET_009"));

        assertThat(checkedInAt(ticketId)).isNull();
    }

    /** 탈퇴하면서 파기된 얼굴도 같은 자리에서 걸린다 */
    @Test
    void 얼굴이_파기된_티켓은_대조할_수_없다() throws Exception {
        Long userId = insertUser("erased@test.com", "탈퇴자");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(userId, fixture, personA(), MODEL);
        jdbcTemplate.update(
                "UPDATE tickets SET face_embedding = NULL, face_model_version = NULL WHERE id = ?", ticketId);

        mockMvc.perform(post("/admin/check-in/verify")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody(qrSigner.sign(ticketId), fixture.performanceDetailId(),
                                personA(), MODEL)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TICKET_009"));
    }

    /** 모델이 다르면 좌표계가 달라 비교가 성립하지 않는다. 낮은 점수로 떨어뜨리지 않는다 */
    @Test
    void 모델_버전이_다르면_거절한다() throws Exception {
        Long userId = insertUser("othermodel@test.com", "다른모델");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(userId, fixture, personA(), MODEL);

        mockMvc.perform(post("/admin/check-in/verify")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody(qrSigner.sign(ticketId), fixture.performanceDetailId(),
                                personA(), "some-other-model@2")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TICKET_010"));
    }

    /** 🔴 얼굴은 마지막이다 — 통과할 수 없는 표에서는 생체정보를 아예 보지 않는다 */
    @Test
    void 취소된_티켓은_얼굴을_보기_전에_끊는다() throws Exception {
        Long userId = insertUser("cancel-face@test.com", "취소자");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(userId, fixture, personA(), MODEL);
        jdbcTemplate.update("UPDATE tickets SET status = 'CANCELLED' WHERE id = ?", ticketId);

        mockMvc.perform(post("/admin/check-in/verify")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody(qrSigner.sign(ticketId), fixture.performanceDetailId(),
                                personA(), MODEL)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TICKET_007"));
    }

    @Test
    void 일반_회원은_검표할_수_없다() throws Exception {
        Long userId = insertUser("normal@test.com", "일반회원");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicketWithFace(userId, fixture, personA(), MODEL);

        mockMvc.perform(post("/admin/check-in/scan")
                        .header("Authorization",
                                "Bearer " + jwtTokenProvider.createAccessToken(userId, UserRole.USER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(scanBody(qrSigner.sign(ticketId), fixture.performanceDetailId())))
                .andExpect(status().isForbidden());
    }

    /* ── 도우미 ────────────────────────────────────────────── */

    /** 같은 방향의 단위 벡터 — 자기 자신과의 코사인 유사도가 1.0 이다 */
    private static float[] personA() {
        float[] embedding = new float[Face.EMBEDDING_DIMENSION];
        embedding[0] = 1f;
        return embedding;
    }

    /** A 와 직교하는 단위 벡터 — 유사도가 0 이라 임계값(0.65)에 한참 못 미친다 */
    private static float[] personB() {
        float[] embedding = new float[Face.EMBEDDING_DIMENSION];
        embedding[1] = 1f;
        return embedding;
    }

    private static float[] defaultFace() {
        float[] embedding = new float[Face.EMBEDDING_DIMENSION];
        Arrays.fill(embedding, (float) (1.0 / Math.sqrt(Face.EMBEDDING_DIMENSION)));
        return embedding;
    }

    private Long insertTicketWithFace(Long userId, Fixture fixture, float[] embedding, String modelVersion) {
        Integer seatNumber = jdbcTemplate.queryForObject(
                "SELECT count(*)::int + 1 FROM seats WHERE area_id = ?", Integer.class, fixture.areaId());
        Long seatId = jdbcTemplate.queryForObject(
                "INSERT INTO seats (area_id, row_label, seat_number) VALUES (?, '3', ?) RETURNING id",
                Long.class, fixture.areaId(), seatNumber);

        return jdbcTemplate.queryForObject(
                "INSERT INTO tickets (user_id, performance_detail_id, area_id, seat_id, status,"
                        + " face_embedding, face_model_version)"
                        + " VALUES (?, ?, ?, ?, 'CONFIRMED', ?::vector, ?) RETURNING id",
                Long.class, userId, fixture.performanceDetailId(), fixture.areaId(), seatId,
                vectorLiteral(embedding), modelVersion);
    }

    private LocalDateTime checkedInAt(Long ticketId) {
        return jdbcTemplate.queryForObject(
                "SELECT checked_in_at FROM tickets WHERE id = ?", LocalDateTime.class, ticketId);
    }

    private String adminToken() {
        long unique = System.nanoTime();
        Long adminId = insertUser("gate-admin-" + unique + "@test.com", "검표원" + unique, "ADMIN");
        return "Bearer " + jwtTokenProvider.createAccessToken(adminId, UserRole.ADMIN);
    }

    private static String numbers(float[] embedding) {
        return IntStream.range(0, embedding.length)
                .mapToObj(i -> String.valueOf(embedding[i]))
                .reduce((a, b) -> a + "," + b)
                .orElse("");
    }

    private static String vectorLiteral(float[] embedding) {
        return "[" + numbers(embedding) + "]";
    }

    private static String scanBody(String qrToken, Long performanceDetailId) {
        return "{\"qrToken\":\"" + qrToken + "\",\"performanceDetailId\":" + performanceDetailId + "}";
    }

    private static String verifyBody(String qrToken, Long performanceDetailId,
                                     float[] embedding, String modelVersion) {
        return "{\"qrToken\":\"" + qrToken + "\",\"performanceDetailId\":" + performanceDetailId
                + ",\"embedding\":[" + numbers(embedding) + "]"
                + ",\"modelVersion\":\"" + modelVersion + "\"}";
    }
}
