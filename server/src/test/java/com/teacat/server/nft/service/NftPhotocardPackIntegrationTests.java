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

    /** 뽑은 카드가 어느 이벤트에서 나왔는지는 조회 쪽(상세·내 포카)이 보여준다 */
    @Autowired
    private NftService nftService;

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

    @Test
    void 상태_응답은_팩마다_개봉_시각과_열림_여부를_준다() {
        Long userId = insertUser("perpack@test.com", "팩별");
        insertWallet(userId);
        insertEvent("PERPACK", "가을 이벤트", "NULL", "NULL", true);
        insertPack(userId, "PERPACK");

        Fixture soon = insertPerformanceFixture();
        Fixture later = insertPerformanceFixture();
        packRepository.save(NftPhotocardPack.grantForTicket(
                userId, insertTicket(userId, soon), soon.performanceDetailId()));
        packRepository.save(NftPhotocardPack.grantForTicket(
                userId, insertTicket(userId, later), later.performanceDetailId()));
        // 하나는 이미 열렸고(개봉 시각이 지남) 하나는 사흘 뒤 공연이다
        setPerformanceDate(soon.performanceDetailId(), "now() + interval '1 minute'");
        setPerformanceDate(later.performanceDetailId(), "now() + interval '3 day'");

        var status = drawService.status(userId);

        // 요약 필드는 그대로다 (구 클라이언트 호환)
        assertThat(status.remaining()).isEqualTo(2);
        assertThat(status.scheduled()).isEqualTo(1);
        assertThat(status.nextOpenAt()).isNotNull();

        assertThat(status.packs()).hasSize(3);
        // 열 수 있는 것이 먼저(이벤트 팩은 시각이 없어 맨 앞), 그다음 개봉이 이른 순
        assertThat(status.packs()).extracting(p -> p.openable()).containsExactly(true, true, false);

        var event = status.packs().get(0);
        assertThat(event.source()).isEqualTo("EVENT");
        assertThat(event.title()).isEqualTo("가을 이벤트");
        assertThat(event.openAt()).isNull();

        var locked = status.packs().get(2);
        assertThat(locked.source()).isEqualTo("TICKET_PURCHASE");
        assertThat(locked.title()).isEqualTo("테스트 공연");
        assertThat(locked.openable()).isFalse();
        // 🔴 개봉 시각은 저장값이 아니라 계산값이다 — 잠긴 팩 중 가장 이른 시각이 nextOpenAt 과 같아야 한다
        assertThat(locked.openAt()).isEqualTo(status.nextOpenAt());
    }

    @Test
    void 공연을_미루면_팩의_개봉_시각도_함께_밀린다() {
        Long userId = insertUser("postpone@test.com", "연기");
        insertWallet(userId);
        Fixture fixture = insertPerformanceFixture();
        packRepository.save(NftPhotocardPack.grantForTicket(
                userId, insertTicket(userId, fixture), fixture.performanceDetailId()));

        setPerformanceDate(fixture.performanceDetailId(), "now() + interval '1 day'");
        var before = drawService.status(userId).packs().getFirst().openAt();

        setPerformanceDate(fixture.performanceDetailId(), "now() + interval '2 day'");
        var after = drawService.status(userId).packs().getFirst().openAt();

        // 저장된 값이 있었다면 옛 시각에 머물렀을 것이다
        assertThat(after).isAfter(before.plusHours(23));
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

    @Test
    void lockedFirstPackDoesNotBlockLaterEventPack() {
        Long userId = insertUser("mixed@test.com", "mixed");
        insertWallet(userId);
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicket(userId, fixture);
        NftPhotocardPack locked = packRepository.save(NftPhotocardPack.grantForTicket(
                userId, ticketId, fixture.performanceDetailId()));
        setPerformanceDate(fixture.performanceDetailId(), "now() + interval '3 day'");
        insertPack(userId, "LATER_EVENT");
        insertDrawPoolDesign("Event card", 100, "Group", "SPECIAL");

        assertThat(drawService.status(userId).remaining()).isEqualTo(1);
        assertThat(drawService.status(userId).scheduled()).isEqualTo(1);
        assertThat(writer.draw(userId, UUID.randomUUID()).photocardId()).isNotNull();
        assertThat(packRepository.findById(locked.getId()).orElseThrow().getConsumedAt()).isNull();
        assertThat(drawService.status(userId).remaining()).isZero();
        assertThat(drawService.status(userId).scheduled()).isEqualTo(1);
    }

    private void insertEvent(String code, String name, String startsAtSql, String endsAtSql,
                             boolean active) {
        jdbcTemplate.update("""
                INSERT INTO nft_photocard_pack_events (code, name, starts_at, ends_at, active)
                VALUES (?, ?, %s, %s, ?)
                """.formatted(startsAtSql, endsAtSql), code, name, active);
    }

    @Test
    void 이벤트_팩에서_나온_카드는_이벤트_이름을_함께_준다() {
        Long userId = insertUser("eventname@test.com", "이름");
        insertWallet(userId);
        insertEvent("AUTUMN", "추석 특별 카드팩", "NULL", "NULL", true);
        insertPack(userId, "AUTUMN");
        insertDrawPoolDesign("김예린", 100, "서울 5반", "SPECIAL");

        Long photocardId = writer.draw(userId, UUID.randomUUID()).photocardId();

        /* 카드팩 카드는 공연이 없어 화면의 둘째 줄이 빈다. 어느 이벤트에서 나왔는지를 함께 준다 */
        var fromPack = nftService.getPhotocard(photocardId, userId);
        assertThat(fromPack.performanceTitle()).isNull();
        assertThat(fromPack.eventName()).isEqualTo("추석 특별 카드팩");

        assertThat(nftService.getMyPhotocards(userId, null, null, null).items())
                .singleElement()
                .satisfies(card -> {
                    assertThat(card.performanceTitle()).isNull();
                    assertThat(card.eventName()).isEqualTo("추석 특별 카드팩");
                });

        /* 🔴 공연 좌석에서 나온 카드에는 이벤트 이름이 붙지 않는다 — 판별 기준은 팩의 출처이고
              "공연명이 null 이다" 가 아니다 (NftMarketQueryRepository 주석) */
        var fromSeat = nftService.getPhotocard(insertPhotocardOwnedBy(userId), userId);
        assertThat(fromSeat.performanceTitle()).isEqualTo("테스트 공연");
        assertThat(fromSeat.eventName()).isNull();
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
    void 시작일이_비어_있는_이벤트는_만든_시각을_시작으로_본다() {
        // 이틀 전에 시작한 이벤트가 켜져 있는 상태에서, 상시 이벤트(시작일 없음)를 새로 연다.
        // 시작일이 비어 있다고 뒤로 밀면 방금 연 쪽이 아니라 예전 것이 지급된다
        insertEvent("OLD", "예전", "now() - interval '2 day'", "NULL", true);
        insertEvent("ALWAYS", "상시", "NULL", "NULL", true);

        assertThat(eventRepository.findOngoing()).get()
                .extracting(NftPhotocardPackEvent::getCode).isEqualTo("ALWAYS");
    }

    @Test
    void 종료가_시작보다_앞서면_등록을_거절한다() throws Exception {
        mockMvc.perform(post("/admin/photocard-pack-events")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"BACKWARD","name":"뒤집힘",
                                 "startsAt":"2026-10-01T00:00:00","endsAt":"2026-09-01T00:00:00"}
                                """))
                .andExpect(status().isBadRequest());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nft_photocard_pack_events WHERE code = 'BACKWARD'",
                Long.class)).isZero();
    }

    @Test
    void 한쪽만_비어_있는_기간은_정상이다() throws Exception {
        mockMvc.perform(post("/admin/photocard-pack-events")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"OPEN_ENDED","name":"무기한","startsAt":"2026-10-01T00:00:00"}
                                """))
                .andExpect(status().isCreated());
    }

    @Test
    void 잠긴_팩만_있을_때의_거절_문구는_카드팩이_없다고_말하지_않는다() {
        // NFT_040 은 "팩이 아예 없을 때" 와 "있지만 아직 안 열렸을 때" 를 같이 쓴다.
        // 문구가 두 경우 모두에서 참이어야 한다
        assertThat(NftErrorCode.PACK_NOT_AVAILABLE.getMessage())
                .isEqualTo("지금 열 수 있는 카드팩이 없어요.");
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
