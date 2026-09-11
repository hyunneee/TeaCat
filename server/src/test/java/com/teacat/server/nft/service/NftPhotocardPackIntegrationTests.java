package com.teacat.server.nft.service;

import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.ipfs.IpfsPinService;
import com.teacat.server.nft.client.PhotocardChainClient;
import com.teacat.server.nft.entity.NftPhotocardPack;
import com.teacat.server.nft.entity.NftPhotocardPackEvent;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftPhotocardPackEventRepository;
import com.teacat.server.nft.repository.NftPhotocardPackRepository;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 카드팩 — 어느 회차의 것인지(performance_detail_id)와 이벤트 표.
 *
 * <p>체인·IPFS 스텁 집합을 {@code NftPhotocardDrawServiceIntegrationTests} 와 맞춘다.
 * 다르면 Spring 컨텍스트가 하나 더 뜬다.
 */
class NftPhotocardPackIntegrationTests extends PostgresIntegrationTest {

    @Autowired
    private NftPhotocardPackRepository packRepository;

    @Autowired
    private NftPhotocardDrawWriter writer;

    @Autowired
    private NftPhotocardDrawService drawService;

    @Autowired
    private NftPhotocardPackEventRepository eventRepository;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private PhotocardChainClient chainClient;

    @MockitoBean
    private IpfsPinService ipfsPinService;

    private String adminToken() {
        Long adminId = insertUser("admin@test.com", "관리자", "ADMIN");
        return "Bearer " + jwtTokenProvider.createAccessToken(adminId, UserRole.ADMIN);
    }

    @Test
    void 티켓_팩은_어느_회차의_것인지를_저장한다() {
        Long userId = insertUser("pack@test.com", "팩주인");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicket(userId, fixture);

        NftPhotocardPack saved = packRepository.save(
                NftPhotocardPack.grantForTicket(userId, ticketId, fixture.performanceDetailId()));

        Map<String, Object> row = jdbcTemplate.queryForMap("""
                SELECT source::text AS source, source_ref, performance_detail_id
                  FROM nft_photocard_packs WHERE id = ?
                """, saved.getId());
        assertThat(row.get("source")).isEqualTo("TICKET_PURCHASE");
        assertThat(row.get("source_ref")).isEqualTo(ticketId.toString());
        assertThat(row.get("performance_detail_id")).isEqualTo(fixture.performanceDetailId());
    }

    @Test
    void 이벤트_팩은_회차가_없다() {
        Long userId = insertUser("event@test.com", "이벤트");

        NftPhotocardPack saved = packRepository.save(NftPhotocardPack.grantEvent(userId, "OPEN_EVENT"));

        Map<String, Object> row = jdbcTemplate.queryForMap("""
                SELECT source::text AS source, source_ref, performance_detail_id
                  FROM nft_photocard_packs WHERE id = ?
                """, saved.getId());
        assertThat(row.get("source")).isEqualTo("EVENT");
        assertThat(row.get("source_ref")).isEqualTo("OPEN_EVENT");
        assertThat(row.get("performance_detail_id")).isNull();
    }

    /** 🔴 이 변경의 핵심. 공연을 미루면 개봉 시각도 함께 밀려야 한다 */
    @Test
    void 공연을_연기하면_개봉_시각도_함께_밀린다() {
        Long userId = insertUser("delay@test.com", "연기");
        insertWallet(userId);
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicket(userId, fixture);
        packRepository.save(
                NftPhotocardPack.grantForTicket(userId, ticketId, fixture.performanceDetailId()));

        // 공연이 코앞이면 열린다 (마감을 이미 지났다)
        setPerformanceDate(fixture.performanceDetailId(), "now() + interval '1 minute'");
        assertThat(drawService.status(userId).available()).isTrue();

        // 공연을 미루면 다시 잠긴다 — 저장된 값이 아니라 회차를 보기 때문이다
        setPerformanceDate(fixture.performanceDetailId(), "now() + interval '3 day'");
        assertThat(drawService.status(userId).available()).isFalse();
        assertThat(drawService.status(userId).scheduled()).isEqualTo(1);
        assertThat(drawService.status(userId).nextOpenAt()).isNotNull();
    }

    private void setPerformanceDate(Long detailId, String sqlExpression) {
        jdbcTemplate.update(
                "UPDATE performance_details SET performance_date = %s WHERE id = ?"
                        .formatted(sqlExpression), detailId);
    }

    @Test
    void 개봉_시각_전인_팩은_열리지_않는다() {
        Long userId = insertUser("locked@test.com", "잠김");
        insertWallet(userId);
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicket(userId, fixture);
        packRepository.save(NftPhotocardPack.grantForTicket(
                userId, ticketId, fixture.performanceDetailId()));
        setPerformanceDate(fixture.performanceDetailId(), "now() + interval '3 day'");

        var status = drawService.status(userId);

        assertThat(status.available()).isFalse();
        assertThat(status.remaining()).isZero();
        assertThat(status.scheduled()).isEqualTo(1);
        assertThat(status.nextOpenAt()).isNotNull();
    }

    @Test
    void 개봉_시각이_지난_팩은_열린다() {
        Long userId = insertUser("open@test.com", "열림");
        insertWallet(userId);
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicket(userId, fixture);
        packRepository.save(NftPhotocardPack.grantForTicket(
                userId, ticketId, fixture.performanceDetailId()));
        setPerformanceDate(fixture.performanceDetailId(), "now() - interval '1 minute'");

        var status = drawService.status(userId);

        assertThat(status.available()).isTrue();
        assertThat(status.remaining()).isEqualTo(1);
        assertThat(status.scheduled()).isZero();
        assertThat(status.nextOpenAt()).isNull();
    }

    @Test
    void 이벤트_팩은_개봉_시각이_없어_바로_열린다() {
        Long userId = insertUser("now@test.com", "즉시");
        insertPack(userId, "OPEN_EVENT");

        var status = drawService.status(userId);

        assertThat(status.available()).isTrue();
        assertThat(status.remaining()).isEqualTo(1);
        assertThat(status.scheduled()).isZero();
    }

    @Test
    void 잠긴_팩만_있으면_뽑기가_거절된다() {
        Long userId = insertUser("deny@test.com", "거절");
        insertWallet(userId);
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicket(userId, fixture);
        packRepository.save(NftPhotocardPack.grantForTicket(
                userId, ticketId, fixture.performanceDetailId()));
        setPerformanceDate(fixture.performanceDetailId(), "now() + interval '3 day'");
        insertDrawPoolDesign("김예린", 100, "서울 5반", "SPECIAL");

        assertThatThrownBy(() -> writer.draw(userId, UUID.randomUUID()))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", NftErrorCode.PACK_NOT_AVAILABLE);
    }

    private void insertEvent(String code, String name, String startsAtSql, String endsAtSql,
                             boolean active) {
        jdbcTemplate.update("""
                INSERT INTO nft_photocard_pack_events (code, name, starts_at, ends_at, active)
                VALUES (?, ?, %s, %s, ?)
                """.formatted(startsAtSql, endsAtSql), code, name, active);
    }

    @Test
    void 진행_중인_이벤트가_없으면_팩을_주지_않는다() {
        Long userId = insertUser("noevent@test.com", "없음");

        assertThat(drawService.claimEventPack(userId).granted()).isFalse();
        assertThat(drawService.claimEventPack(userId).remaining()).isZero();
    }

    @Test
    void 진행_중인_이벤트의_코드로_팩을_한_번만_준다() {
        Long userId = insertUser("evt@test.com", "이벤트");
        insertEvent("SUMMER", "여름 이벤트", "NULL", "NULL", true);

        assertThat(drawService.claimEventPack(userId).granted()).isTrue();
        assertThat(drawService.claimEventPack(userId).granted()).isFalse();

        assertThat(jdbcTemplate.queryForObject("""
                SELECT source_ref FROM nft_photocard_packs WHERE user_id = ?
                """, String.class, userId)).isEqualTo("SUMMER");
    }

    @Test
    void 닫힌_이벤트와_기간_밖_이벤트는_대상이_아니다() {
        insertEvent("CLOSED", "닫힘", "NULL", "NULL", false);
        insertEvent("FUTURE", "미래", "now() + interval '1 day'", "NULL", true);
        insertEvent("PAST", "과거", "NULL", "now() - interval '1 minute'", true);

        assertThat(eventRepository.findOngoing()).isEmpty();
    }

    @Test
    void 둘_이상_진행_중이면_가장_최근_것을_쓴다() {
        insertEvent("OLD", "예전", "now() - interval '2 day'", "NULL", true);
        insertEvent("NEW", "최근", "now() - interval '1 hour'", "NULL", true);

        assertThat(eventRepository.findOngoing()).get()
                .extracting(NftPhotocardPackEvent::getCode).isEqualTo("NEW");
    }

    @Test
    void 어드민이_이벤트를_등록하고_목록에서_지급_수를_본다() throws Exception {
        String token = adminToken();
        Long userId = insertUser("claimer@test.com", "받는사람");

        mockMvc.perform(post("/admin/photocard-pack-events")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"SUMMER","name":"여름 이벤트"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.code").value("SUMMER"))
                .andExpect(jsonPath("$.data.ongoing").value(true))
                .andExpect(jsonPath("$.data.grantedCount").value(0));

        drawService.claimEventPack(userId);

        mockMvc.perform(get("/admin/photocard-pack-events").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].code").value("SUMMER"))
                .andExpect(jsonPath("$.data[0].grantedCount").value(1));
    }

    @Test
    void 같은_코드는_두_번_등록되지_않는다() throws Exception {
        String token = adminToken();
        insertEvent("SUMMER", "여름", "NULL", "NULL", true);

        mockMvc.perform(post("/admin/photocard-pack-events")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"SUMMER","name":"또 여름"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NFT_044"));
    }

    @Test
    void 어드민이_이벤트를_닫으면_더_주지_않는다() throws Exception {
        String token = adminToken();
        Long userId = insertUser("late@test.com", "늦은사람");
        insertEvent("SUMMER", "여름", "NULL", "NULL", true);
        Long eventId = jdbcTemplate.queryForObject(
                "SELECT id FROM nft_photocard_pack_events WHERE code = 'SUMMER'", Long.class);

        mockMvc.perform(patch("/admin/photocard-pack-events/" + eventId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"active":false}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(false))
                .andExpect(jsonPath("$.data.ongoing").value(false));

        assertThat(drawService.claimEventPack(userId).granted()).isFalse();
    }

    @Test
    void 없는_이벤트를_열고닫으면_404() throws Exception {
        mockMvc.perform(patch("/admin/photocard-pack-events/99999")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"active":true}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NFT_045"));
    }
}
