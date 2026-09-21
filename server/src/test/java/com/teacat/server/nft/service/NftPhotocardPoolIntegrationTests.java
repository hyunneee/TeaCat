package com.teacat.server.nft.service;

import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.ipfs.IpfsPinService;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.nft.client.PhotocardChainClient;
import com.teacat.server.nft.client.PhotocardDesignRegisterResult;
import com.teacat.server.nft.client.PhotocardNftMetadata;
import com.teacat.server.nft.entity.NftDesignChainStatus;
import com.teacat.server.nft.entity.NftPhotocardDesign;
import com.teacat.server.nft.entity.NftPhotocardGrade;
import com.teacat.server.nft.entity.NftPhotocardPack;
import com.teacat.server.nft.entity.NftPhotocardTemplate;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftPhotocardPackRepository;
import com.teacat.server.nft.repository.NftPhotocardTemplateRepository;
import com.teacat.server.nft.service.NftPhotocardDrawWriter.DrawOutcome;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.willReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 템플릿 + 수량 → 도안. 등록은 그림만, 수량은 쓸 때 정한다.
 *
 * <p>체인·IPFS 스텁 집합을 다른 nft 통합 테스트와 맞춘다. 다르면 Spring 컨텍스트가 하나 더 뜬다.
 */
class NftPhotocardPoolIntegrationTests extends PostgresIntegrationTest {

    @Test void organizerPoolAccessIsScopedToOwnPerformance() throws Exception {
        Long owner = insertUser("pool-owner@test.com", "poolowner", "PERFORMANCE");
        Fixture own = insertPerformanceFixture();
        Fixture other = insertPerformanceFixture();
        jdbcTemplate.update("UPDATE performance_general SET created_by = ? WHERE id = ?", owner, own.performanceId());
        String auth = "Bearer " + jwtTokenProvider.createAccessToken(owner, UserRole.PERFORMANCE);
        mockMvc.perform(get("/admin/photocard-templates").header("Authorization", auth)).andExpect(status().isOk());
        mockMvc.perform(get("/admin/performances/" + own.performanceId() + "/draw-designs").header("Authorization", auth)).andExpect(status().isOk());
        mockMvc.perform(get("/admin/performances/" + other.performanceId() + "/draw-designs").header("Authorization", auth)).andExpect(status().isForbidden());
        Long template = insertTemplate("Scope", "Group", "COMMON");
        Long foreign = insertPoolDesign(other.performanceId(), template, 10);
        mockMvc.perform(post("/admin/photocard-designs/" + foreign + "/chain-registration").header("Authorization", auth)).andExpect(status().isForbidden());
        mockMvc.perform(patch("/admin/photocard-designs/" + foreign + "/draw-pool").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content("{\"drawPool\":false}")).andExpect(status().isForbidden());
        mockMvc.perform(post("/admin/photocard-designs/event-pool").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content("{\"items\":[{\"templateId\":"+template+",\"totalSupply\":10}]}")).andExpect(status().isForbidden());
        mockMvc.perform(post("/admin/performances/" + other.performanceId() + "/draw-designs").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content("{\"items\":[{\"templateId\":"+template+",\"totalSupply\":10}]}")).andExpect(status().isForbidden());
        verifyNoInteractions(ipfsPinService, chainClient);
    }

    @Autowired
    private NftPhotocardTemplateRepository templateRepository;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private PhotocardChainClient chainClient;

    @MockitoBean
    private IpfsPinService ipfsPinService;

    @MockitoBean
    private FileStorageService fileStorageService;

    @Autowired
    private NftPhotocardPackRepository packRepository;

    @Autowired
    private NftPhotocardDrawWriter writer;

    @Autowired
    private NftService nftService;

    @Test
    void 티켓_팩은_그_공연의_도안에서만_뽑힌다() {
        Long userId = insertUser("draw@test.com", "뽑는사람");
        insertWallet(userId);
        Fixture mine = insertPerformanceFixture();
        Long ticketId = insertTicket(userId, mine);
        Long templateA = insertTemplate("A카드", "서울 5반", "SPECIAL");
        Long templateB = insertTemplate("B카드", "서울 5반", "COMMON");
        Long templateC = insertTemplate("C카드", "서울 5반", "COMMON");

        Long forMine = insertPoolDesign(mine.performanceId(), templateA, 20);
        insertPoolDesign(null, templateB, 100);   // 이벤트 풀 — 후보가 아니어야 한다
        // 🔴 H2: 다른 공연의 뽑기 풀 도안. lockRandomDrawCandidateForSchedule 의
        // "pd.id = :performanceDetailId" 를 지워도, 이벤트 풀(공연 NULL)은 INNER JOIN 에서
        // 어차피 빠지므로 후보가 여전히 하나뿐이라 이 도안이 없으면 그 결함이 안 드러난다
        Fixture other = insertPerformanceFixture();
        Long forOther = insertPoolDesign(other.performanceId(), templateC, 20);

        packRepository.save(NftPhotocardPack.grantForTicket(userId, ticketId, mine.performanceDetailId()));
        setPerformanceDatePast(mine.performanceDetailId());
        setPerformanceDatePast(other.performanceDetailId());

        DrawOutcome outcome = writer.draw(userId, UUID.randomUUID());

        assertThat(outcome.designId()).isEqualTo(forMine).isNotEqualTo(forOther);
    }

    @Test
    void 이벤트_팩은_이벤트_풀에서만_뽑힌다() {
        Long userId = insertUser("event@test.com", "이벤트");
        insertWallet(userId);
        Fixture other = insertPerformanceFixture();
        Long templateA = insertTemplate("A카드", "서울 5반", "SPECIAL");
        Long templateB = insertTemplate("B카드", "서울 5반", "COMMON");

        Long eventDesign = insertPoolDesign(null, templateA, 100);
        Long performanceDesign = insertPoolDesign(other.performanceId(), templateB, 20);

        insertPack(userId, "OPEN_EVENT");   // 회차 없는 팩

        DrawOutcome outcome = writer.draw(userId, UUID.randomUUID());

        assertThat(outcome.designId()).isEqualTo(eventDesign).isNotEqualTo(performanceDesign);
    }

    @Test
    void 카드를_안_넣은_공연은_뽑기가_실패한다() {
        Long userId = insertUser("empty@test.com", "빈풀");
        insertWallet(userId);
        Fixture mine = insertPerformanceFixture();
        Long ticketId = insertTicket(userId, mine);
        Long templateId = insertTemplate("A카드", "서울 5반", "SPECIAL");
        // 이벤트 풀에는 카드가 있지만 이 공연에는 없다 — 이벤트 풀로 떨어지면 안 된다
        insertPoolDesign(null, templateId, 100);

        packRepository.save(NftPhotocardPack.grantForTicket(userId, ticketId, mine.performanceDetailId()));
        setPerformanceDatePast(mine.performanceDetailId());

        assertThatThrownBy(() -> writer.draw(userId, UUID.randomUUID()))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", NftErrorCode.DRAW_POOL_EMPTY);
    }

    @Test
    void 온체인_미등록_도안만_있으면_그_공연_뽑기가_실패한다() {
        // 🔴 H3: lockRandomDrawCandidateForSchedule 의 chain_status = 'REGISTERED' 조건을 증명한다.
        // 픽스처 insertPoolDesign 은 늘 REGISTERED 라 이 조건을 지워도 다른 테스트는 통과해 버린다.
        // PENDING 도안이 뽑히면 온체인에 없는 카드가 나간다
        Long userId = insertUser("pending@test.com", "미등록만");
        insertWallet(userId);
        Fixture mine = insertPerformanceFixture();
        Long ticketId = insertTicket(userId, mine);
        Long templateId = insertTemplate("A카드", "서울 5반", "SPECIAL");
        Long designId = insertPoolDesign(mine.performanceId(), templateId, 20);
        jdbcTemplate.update(
                "UPDATE nft_photocard_designs SET chain_status = 'PENDING' WHERE id = ?", designId);

        packRepository.save(NftPhotocardPack.grantForTicket(userId, ticketId, mine.performanceDetailId()));
        setPerformanceDatePast(mine.performanceDetailId());

        assertThatThrownBy(() -> writer.draw(userId, UUID.randomUUID()))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", NftErrorCode.DRAW_POOL_EMPTY);
        // 카드가 만들어지지 않았어야 한다 — 결과 상태를 DB 에서 확인한다
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocards", Long.class)).isZero();
    }

    @Test
    void 소진된_도안만_있으면_그_공연_뽑기가_실패한다() {
        // 🔴 H3: lockRandomDrawCandidateForSchedule 의 issued_supply < total_supply 조건을 증명한다.
        // 픽스처 insertPoolDesign 은 늘 issued_supply = 0 이라 이 조건을 지워도 다른 테스트는
        // 통과해 버린다
        Long userId = insertUser("soldout@test.com", "소진만");
        insertWallet(userId);
        Fixture mine = insertPerformanceFixture();
        Long ticketId = insertTicket(userId, mine);
        Long templateId = insertTemplate("A카드", "서울 5반", "SPECIAL");
        Long designId = insertPoolDesign(mine.performanceId(), templateId, 5);
        jdbcTemplate.update(
                "UPDATE nft_photocard_designs SET issued_supply = total_supply WHERE id = ?", designId);

        packRepository.save(NftPhotocardPack.grantForTicket(userId, ticketId, mine.performanceDetailId()));
        setPerformanceDatePast(mine.performanceDetailId());

        assertThatThrownBy(() -> writer.draw(userId, UUID.randomUUID()))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", NftErrorCode.DRAW_POOL_EMPTY);
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocards", Long.class)).isZero();
    }

    /** 팩이 열리도록 회차를 마감 안쪽으로 옮긴다 */
    private void setPerformanceDatePast(Long detailId) {
        jdbcTemplate.update(
                "UPDATE performance_details SET performance_date = now() - interval '1 minute' WHERE id = ?",
                detailId);
    }

    @Test
    void 템플릿은_수량도_체인_상태도_없이_저장된다() {
        NftPhotocardTemplate saved = templateRepository.save(NftPhotocardTemplate.create(
                "김예린", "2026 단독 콘서트 기념", "bafyIMG", "/gateway/bafyIMG",
                "서울 5반", NftPhotocardGrade.SPECIAL));

        Map<String, Object> row = jdbcTemplate.queryForMap("""
                SELECT name, description, image_cid, image_url, group_name, grade::text AS grade, hidden
                  FROM nft_photocard_templates WHERE id = ?
                """, saved.getId());
        assertThat(row.get("name")).isEqualTo("김예린");
        assertThat(row.get("description")).isEqualTo("2026 단독 콘서트 기념");
        assertThat(row.get("image_cid")).isEqualTo("bafyIMG");
        assertThat(row.get("group_name")).isEqualTo("서울 5반");
        assertThat(row.get("grade")).isEqualTo("SPECIAL");
        assertThat(row.get("hidden")).isEqualTo(false);
    }

    @Test
    void 감춘_템플릿은_목록에서_빠진다() {
        NftPhotocardTemplate shown = templateRepository.save(NftPhotocardTemplate.create(
                "보임", null, "bafy1", "/1", "서울 5반", NftPhotocardGrade.COMMON));
        NftPhotocardTemplate hidden = templateRepository.save(NftPhotocardTemplate.create(
                "감춤", null, "bafy2", "/2", "서울 5반", NftPhotocardGrade.COMMON));
        hidden.changeHidden(true);
        templateRepository.saveAndFlush(hidden);

        assertThat(templateRepository.findAllByHiddenFalseOrderByIdDesc())
                .extracting(NftPhotocardTemplate::getId)
                .containsExactly(shown.getId());
    }

    @Test
    void 어드민이_템플릿을_등록하면_이미지만_핀하고_체인에_올리지_않는다() throws Exception {
        willReturn("bafyIMG").given(ipfsPinService).pinImage(any());
        willReturn("/gateway/bafyIMG").given(ipfsPinService).gatewayUrl("bafyIMG");

        mockMvc.perform(multipart("/admin/photocard-templates")
                        .file(new MockMultipartFile("image", "card.png", "image/png", "bytes".getBytes()))
                        .param("name", "김예린")
                        .param("description", "2026 단독 콘서트 기념")
                        .param("group", "서울 5반")
                        .param("grade", "SPECIAL")
                        .header("Authorization", adminToken()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("김예린"))
                .andExpect(jsonPath("$.data.imageUrl").value("/gateway/bafyIMG"))
                .andExpect(jsonPath("$.data.hidden").value(false))
                .andExpect(jsonPath("$.data.usedCount").value(0));

        // 🔴 템플릿은 체인에 올라가지 않는다 — 수량이 없으니 등록할 값이 없다
        verifyNoInteractions(chainClient);
        // 메타데이터도 핀하지 않는다. 그건 도안을 만들 때 한다
        verify(ipfsPinService, never()).pinJson(anyString(), any());
    }

    @Test
    void 공연기획자도_템플릿을_등록할_수_있지만_감출_수는_없다() throws Exception {
        Long organizerId = insertUser("template-owner@test.com", "템플릿기획자", "PERFORMANCE");
        String token = "Bearer " + jwtTokenProvider.createAccessToken(organizerId, UserRole.PERFORMANCE);
        willReturn("bafyPERFORMANCE").given(ipfsPinService).pinImage(any());
        willReturn("/gateway/bafyPERFORMANCE").given(ipfsPinService).gatewayUrl("bafyPERFORMANCE");

        mockMvc.perform(multipart("/admin/photocard-templates")
                        .file(new MockMultipartFile("image", "card.png", "image/png", "bytes".getBytes()))
                        .param("name", "기획자 카드")
                        .param("group", "서울 5반")
                        .param("grade", "COMMON")
                        .header("Authorization", token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("기획자 카드"));

        Long templateId = templateRepository.findAllByHiddenFalseOrderByIdDesc().getFirst().getId();
        mockMvc.perform(patch("/admin/photocard-templates/" + templateId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"hidden\":true}"))
                .andExpect(status().isForbidden());

        assertThat(templateRepository.findById(templateId).orElseThrow().isHidden()).isFalse();
        verifyNoInteractions(chainClient);
    }

    @Test
    void 어드민이_템플릿을_감추면_목록에서_빠진다() throws Exception {
        Long templateId = insertTemplate("김예린", "서울 5반", "SPECIAL");
        String token = adminToken();

        mockMvc.perform(patch("/admin/photocard-templates/" + templateId)
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"hidden":true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hidden").value(true));

        mockMvc.perform(get("/admin/photocard-templates").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    void 없는_템플릿을_감추면_404() throws Exception {
        mockMvc.perform(patch("/admin/photocard-templates/99999")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"hidden":true}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NFT_046"));
    }

    @Test
    void 공연에_묶인_뽑기_풀_도안이_저장된다() {
        Fixture fixture = insertPerformanceFixture();
        Long templateId = insertTemplate("김예린", "서울 5반", "SPECIAL");

        // 지금까지 CHECK 가 금지해 온 조합: draw_pool = true 인데 공연이 있다
        Long designId = insertPoolDesign(fixture.performanceId(), templateId, 20);

        Map<String, Object> row = jdbcTemplate.queryForMap("""
                SELECT performance_general_id, draw_pool, template_id, total_supply
                  FROM nft_photocard_designs WHERE id = ?
                """, designId);
        assertThat(row.get("performance_general_id")).isEqualTo(fixture.performanceId());
        assertThat(row.get("draw_pool")).isEqualTo(true);
        assertThat(row.get("template_id")).isEqualTo(templateId);
        assertThat(row.get("total_supply")).isEqualTo(20);
    }

    @Test
    void 같은_템플릿을_같은_공연에_두_번_넣지_않는다() {
        Fixture fixture = insertPerformanceFixture();
        Long templateId = insertTemplate("김예린", "서울 5반", "SPECIAL");
        insertPoolDesign(fixture.performanceId(), templateId, 20);

        assertThatThrownBy(() -> insertPoolDesign(fixture.performanceId(), templateId, 30))
                .hasMessageContaining("uq_nft_photocard_designs_template");
    }

    @Test
    void 같은_템플릿을_이벤트_풀에_두_번_넣지_않는다() {
        Long templateId = insertTemplate("김예린", "서울 5반", "SPECIAL");
        insertPoolDesign(null, templateId, 50);

        // 🔴 performance_general_id 가 NULL 이면 PostgreSQL UNIQUE 는 서로 다른 값으로 본다.
        //    COALESCE 로 묶어야 이벤트 풀의 중복도 막힌다
        assertThatThrownBy(() -> insertPoolDesign(null, templateId, 60))
                .hasMessageContaining("uq_nft_photocard_designs_template");
    }

    @Test
    void 공연도_뽑기_풀도_아닌_도안은_저장되지_않는다() {
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO nft_photocard_designs
                    (performance_general_id, name, image_url, total_supply, draw_pool)
                VALUES (NULL, '떠돌이', '/x.png', 1, false)
                """))
                .hasMessageContaining("chk_nft_photocard_designs_pool");
    }

    @Test
    void 템플릿에서_만든_도안은_그림과_속성을_물려받고_수량만_새로_받는다() {
        Fixture fixture = insertPerformanceFixture();
        Long templateId = insertTemplate("김예린", "서울 5반", "SPECIAL");
        NftPhotocardTemplate template = templateRepository.findById(templateId).orElseThrow();

        NftPhotocardDesign design = NftPhotocardDesign.fromTemplate(
                template, fixture.performanceId(), "김예린 · 테스트 공연", 20, "bafyMETA_NEW");

        assertThat(design.getPerformanceId()).isEqualTo(fixture.performanceId());
        assertThat(design.getName()).isEqualTo("김예린 · 테스트 공연");
        assertThat(design.getTotalSupply()).isEqualTo(20);
        assertThat(design.getIssuedSupply()).isZero();
        assertThat(design.getTemplateId()).isEqualTo(templateId);
        assertThat(design.isDrawPool()).isTrue();
        // 그림은 템플릿과 같은 CID 를 가리킨다 — 다시 올리지 않는다
        assertThat(design.getImageCid()).isEqualTo(template.getImageCid());
        assertThat(design.getImageUrl()).isEqualTo(template.getImageUrl());
        assertThat(design.getGroupName()).isEqualTo("서울 5반");
        assertThat(design.getGrade()).isEqualTo(NftPhotocardGrade.SPECIAL);
        assertThat(design.getMetadataCid()).isEqualTo("bafyMETA_NEW");
        assertThat(design.getChainStatus()).isEqualTo(NftDesignChainStatus.PENDING);
    }

    @Test
    void 공연_도안_메타데이터에는_공연이_속성으로_들어간다() {
        PhotocardNftMetadata metadata = PhotocardNftMetadata.ofPerformancePool(
                "김예린 · 2026 단독 콘서트", "설명", "bafyIMG", "서울 5반", "SPECIAL", "2026 단독 콘서트");

        assertThat(metadata.image()).isEqualTo("ipfs://bafyIMG");
        assertThat(metadata.attributes())
                .extracting(PhotocardNftMetadata.Attribute::traitType)
                .containsExactly("소속", "등급", "공연");
        assertThat(metadata.attributes())
                .extracting(PhotocardNftMetadata.Attribute::value)
                .containsExactly("서울 5반", "SPECIAL", "2026 단독 콘서트");
    }

    @Test
    void 템플릿_목록은_만들어진_도안_수를_알려준다() throws Exception {
        Fixture fixture = insertPerformanceFixture();
        Long templateId = insertTemplate("김예린", "서울 5반", "SPECIAL");
        insertPoolDesign(fixture.performanceId(), templateId, 20);
        insertPoolDesign(null, templateId, 50);

        mockMvc.perform(get("/admin/photocard-templates").header("Authorization", adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].usedCount").value(2));
    }

    @Test
    void 공연에_템플릿과_수량을_넣으면_도안이_생기고_온체인에_올라간다() throws Exception {
        Fixture fixture = insertPerformanceFixture();
        Long templateId = insertTemplate("김예린", "서울 5반", "SPECIAL");
        givenPinAndChainOk();

        mockMvc.perform(post("/admin/performances/" + fixture.performanceId() + "/draw-designs")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"items":[{"templateId":%d,"totalSupply":20}]}
                                """.formatted(templateId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.designs[0].performanceId").value(fixture.performanceId()))
                .andExpect(jsonPath("$.data.designs[0].drawPool").value(true))
                .andExpect(jsonPath("$.data.designs[0].templateId").value(templateId))
                .andExpect(jsonPath("$.data.designs[0].totalSupply").value(20))
                .andExpect(jsonPath("$.data.designs[0].remaining").value(20));

        // 그림은 다시 올리지 않았다 — 템플릿의 CID 를 그대로 쓴다
        verify(ipfsPinService, never()).pinImage(any());
        // 메타데이터는 새로 핀했고 온체인 등록이 나갔다
        verify(ipfsPinService).pinJson(anyString(), any());
        verify(chainClient).registerDesign(anyLong(), any(), eq(20), anyString());
    }

    @Test
    void 도안_이름에는_공연_제목이_붙는다() throws Exception {
        Fixture fixture = insertPerformanceFixture();
        Long templateId = insertTemplate("김예린", "서울 5반", "SPECIAL");
        givenPinAndChainOk();

        mockMvc.perform(post("/admin/performances/" + fixture.performanceId() + "/draw-designs")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"items":[{"templateId":%d,"totalSupply":20}]}
                                """.formatted(templateId)))
                .andExpect(status().isCreated());

        // insertPerformanceFixture 의 공연 제목은 '테스트 공연' 이다
        assertThat(jdbcTemplate.queryForObject("""
                SELECT name FROM nft_photocard_designs WHERE template_id = ?
                """, String.class, templateId)).isEqualTo("김예린 · 테스트 공연");
    }

    @Test
    void 같은_템플릿을_같은_공연에_다시_넣으면_거절한다() throws Exception {
        Fixture fixture = insertPerformanceFixture();
        Long templateId = insertTemplate("김예린", "서울 5반", "SPECIAL");
        insertPoolDesign(fixture.performanceId(), templateId, 20);
        givenPinAndChainOk();

        mockMvc.perform(post("/admin/performances/" + fixture.performanceId() + "/draw-designs")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"items":[{"templateId":%d,"totalSupply":30}]}
                                """.formatted(templateId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NFT_047"));
    }

    @Test
    void 요청_안에서_같은_템플릿이_중복되면_거절하고_아무것도_만들지_않는다() throws Exception {
        Fixture fixture = insertPerformanceFixture();
        Long templateId = insertTemplate("김예린", "서울 5반", "SPECIAL");
        String token = adminToken();
        givenPinAndChainOk();

        // 같은 templateId 를 요청 한 번에 두 번 보낸다 — 이 시점엔 둘 다 DB 에 없으므로
        // DB 조회만으로는 걸러지지 않는다. 요청 자체의 중복을 먼저 봐야 한다
        mockMvc.perform(post("/admin/performances/" + fixture.performanceId() + "/draw-designs")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"items":[{"templateId":%d,"totalSupply":20},
                                          {"templateId":%d,"totalSupply":30}]}
                                """.formatted(templateId, templateId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NFT_047"));

        // 🔴 첫 번째 항목조차 저장되거나 체인에 올라가지 않아야 한다 — "일부만 체인에 올라가는" 상태를
        // 막는 것이 이 결함의 핵심이다
        assertThat(jdbcTemplate.queryForObject("""
                SELECT count(*) FROM nft_photocard_designs WHERE template_id = ?
                """, Long.class, templateId)).isZero();
        verifyNoInteractions(chainClient);
    }

    @Test
    void 하나라도_잘못됐으면_아무것도_만들지_않는다() throws Exception {
        Fixture fixture = insertPerformanceFixture();
        Long goodId = insertTemplate("김예린", "서울 5반", "SPECIAL");
        givenPinAndChainOk();

        mockMvc.perform(post("/admin/performances/" + fixture.performanceId() + "/draw-designs")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"items":[{"templateId":%d,"totalSupply":20},
                                          {"templateId":99999,"totalSupply":20}]}
                                """.formatted(goodId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NFT_046"));

        // 검증을 먼저 다 하므로 정상 항목도 만들어지지 않는다
        assertThat(jdbcTemplate.queryForObject("""
                SELECT count(*) FROM nft_photocard_designs WHERE template_id IS NOT NULL
                """, Long.class)).isZero();
        verifyNoInteractions(chainClient);
    }

    @Test
    void 풀_조회는_전_회차_좌석_합계와_잔여_합계를_함께_준다() throws Exception {
        Fixture fixture = insertPerformanceFixture();
        // 지정석은 max_cnt 를 저장하지 않는다. 공연장 구역의 좌석 수(max_seat)를 사용해야 한다.
        jdbcTemplate.update("""
                UPDATE performance_areas SET max_cnt = NULL
                 WHERE performance_general_id = ? AND area_id = ?
                """, fixture.performanceId(), fixture.areaId());
        Long templateId = insertTemplate("김예린", "서울 5반", "SPECIAL");
        insertPoolDesign(fixture.performanceId(), templateId, 20);
        // 공연 전용 도안(draw_pool = false)은 이 목록에서 빠진다
        insertDesign(fixture.performanceId(), "공연 전용 도안", 50);

        mockMvc.perform(get("/admin/performances/" + fixture.performanceId() + "/draw-designs")
                        .header("Authorization", adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.designs.length()").value(1))
                .andExpect(jsonPath("$.data.designs[0].templateId").value(templateId))
                .andExpect(jsonPath("$.data.poolRemaining").value(20))
                .andExpect(jsonPath("$.data.seatCapacity").value(1000))
                // 20 < 1000 이라 모자라다 — 프론트가 경고할 근거다
                .andExpect(jsonPath("$.data.sufficient").value(false));
    }

    @Test
    void 지정석과_스탠딩_수용인원을_전_회차만큼_합산한다() throws Exception {
        Fixture fixture = insertPerformanceFixture();
        jdbcTemplate.update("""
                UPDATE performance_areas SET max_cnt = NULL
                 WHERE performance_general_id = ? AND area_id = ?
                """, fixture.performanceId(), fixture.areaId());
        Long standingAreaId = jdbcTemplate.queryForObject("""
                INSERT INTO areas
                    (stadium_id, stadium_layout_id, level_code, area_code, type, max_seat)
                SELECT stadium_id, stadium_layout_id, '1F', 'B', 'STANDING', 800
                  FROM areas WHERE id = ?
                RETURNING id
                """, Long.class, fixture.areaId());
        jdbcTemplate.update("""
                INSERT INTO performance_areas
                    (performance_general_id, area_id, grade, price, max_cnt, sale_type)
                VALUES (?, ?, 'R', 80000, 600, 'STANDING')
                """, fixture.performanceId(), standingAreaId);
        jdbcTemplate.update("""
                INSERT INTO performance_details (performance_general_id, performance_num,
                                                 performance_date, status)
                VALUES (?, 2, now() + interval '1 day', 'SCHEDULED')
                """, fixture.performanceId());

        mockMvc.perform(get("/admin/performances/" + fixture.performanceId() + "/draw-designs")
                        .header("Authorization", adminToken()))
                .andExpect(status().isOk())
                // (지정석 1000석 + 스탠딩 정원 600명) × 2회차
                .andExpect(jsonPath("$.data.seatCapacity").value(3200));
    }

    @Test
    void 이벤트_풀에_넣은_도안은_공연이_없다() throws Exception {
        Long templateId = insertTemplate("김예린", "서울 5반", "SPECIAL");
        givenPinAndChainOk();

        mockMvc.perform(post("/admin/photocard-designs/event-pool")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"items":[{"templateId":%d,"totalSupply":50}]}
                                """.formatted(templateId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data[0].performanceId").doesNotExist())
                .andExpect(jsonPath("$.data[0].drawPool").value(true))
                .andExpect(jsonPath("$.data[0].totalSupply").value(50));

        // 이벤트 풀 도안 이름에는 공연이 붙지 않는다
        assertThat(jdbcTemplate.queryForObject("""
                SELECT name FROM nft_photocard_designs WHERE template_id = ?
                """, String.class, templateId)).isEqualTo("김예린");
    }

    @Test
    void 같은_템플릿을_이벤트_풀에_다시_넣으면_거절한다() throws Exception {
        Long templateId = insertTemplate("김예린", "서울 5반", "SPECIAL");
        insertPoolDesign(null, templateId, 50);
        givenPinAndChainOk();

        mockMvc.perform(post("/admin/photocard-designs/event-pool")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"items":[{"templateId":%d,"totalSupply":60}]}
                                """.formatted(templateId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NFT_047"));
    }

    @Test
    void 이벤트_풀_요청_안에서_같은_템플릿이_중복되면_거절하고_아무것도_만들지_않는다() throws Exception {
        Long templateId = insertTemplate("김예린", "서울 5반", "SPECIAL");
        String token = adminToken();
        givenPinAndChainOk();

        // addToPerformance 와 같은 결함이 addToEventPool 에도 있을 수 있다 — 같은 templateId 를
        // 한 요청에 두 번 보내 요청 내부 중복 검사가 DB 조회보다 먼저 걸리는지 본다
        mockMvc.perform(post("/admin/photocard-designs/event-pool")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"items":[{"templateId":%d,"totalSupply":20},
                                          {"templateId":%d,"totalSupply":30}]}
                                """.formatted(templateId, templateId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NFT_047"));

        // 🔴 첫 번째 항목조차 저장되거나 체인에 올라가지 않아야 한다
        assertThat(jdbcTemplate.queryForObject("""
                SELECT count(*) FROM nft_photocard_designs WHERE template_id = ?
                """, Long.class, templateId)).isZero();
        verifyNoInteractions(chainClient);
    }

    @Test
    void 기존_도안_등록_API_는_뽑기_풀을_더_받지_않는다() throws Exception {
        // drawPool = true 경로는 템플릿 방식이 대신한다
        mockMvc.perform(multipart("/admin/photocard-designs")
                        .file(new MockMultipartFile("image", "c.png", "image/png", "b".getBytes()))
                        .param("name", "직접등록")
                        .param("totalSupply", "10")
                        .param("drawPool", "true")
                        .param("group", "서울 5반")
                        .param("grade", "SPECIAL")
                        .header("Authorization", adminToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("NFT_042"));
    }

    @Test
    void 이벤트_풀_메타데이터에는_소속과_등급_속성만_들어간다() {
        // NftPhotocardDesignServiceIntegrationTests 의 옛 drawPool=true 경로 테스트가 검증하던
        // "소속·등급 속성 구성"을 여기로 옮겼다 — 그 경로는 이제 등록 자체를 거절하기 때문이다
        PhotocardNftMetadata metadata = PhotocardNftMetadata.ofDrawPool(
                "김예린", "설명", "bafyIMG", "서울 5반", "SPECIAL");

        assertThat(metadata.image()).isEqualTo("ipfs://bafyIMG");
        assertThat(metadata.attributes())
                .extracting(PhotocardNftMetadata.Attribute::traitType)
                .containsExactly("소속", "등급");
        assertThat(metadata.attributes())
                .extracting(PhotocardNftMetadata.Attribute::value)
                .containsExactly("서울 5반", "SPECIAL");
    }

    @Test
    void 이벤트_풀_목록에는_공연별_도안이_섞이지_않는다() throws Exception {
        Fixture fixture = insertPerformanceFixture();
        Long templateA = insertTemplate("A카드", "서울 5반", "SPECIAL");
        Long templateB = insertTemplate("B카드", "서울 5반", "COMMON");
        Long eventDesign = insertPoolDesign(null, templateA, 100);
        insertPoolDesign(fixture.performanceId(), templateB, 20);

        mockMvc.perform(get("/admin/photocard-designs/draw-pool")
                        .header("Authorization", adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].designId").value(eventDesign));
    }

    @Test
    void 공연_도안_목록에는_뽑기_풀_도안이_섞이지_않는다() throws Exception {
        Fixture fixture = insertPerformanceFixture();
        Long performanceDesignId = insertDesign(fixture.performanceId(), "공연 전용 도안", 50);
        Long templateId = insertTemplate("A카드", "서울 5반", "SPECIAL");
        insertPoolDesign(fixture.performanceId(), templateId, 20);

        // 이 목록은 자동 발급 전 "도안이 전부 등록됐는지" 확인용이라 뽑기 풀이 섞이면 안 된다
        mockMvc.perform(get("/admin/photocard-designs")
                        .param("performanceId", String.valueOf(fixture.performanceId()))
                        .header("Authorization", adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].designId").value(performanceDesignId));
    }

    @Test
    void 회차_발급은_뽑기_풀_도안을_배정하지_않는다() {
        Long userId = insertUser("issue@test.com", "발급");
        insertWallet(userId);
        Fixture fixture = insertPerformanceFixture();
        insertTicket(userId, fixture);
        // 🔴 뽑기 풀 도안을 공연 도안보다 먼저 넣어 id 를 더 낮게 만든다. 배정 배열은 id 오름차순을
        // 앞에서부터 채우므로(NftPhotocardScheduleAllocator), draw_pool 필터가 없으면 수령자 1명의
        // 몫이 풀 도안 쪽으로 먼저 배정돼 버그가 실제로 드러난다 — 순서가 반대면 공연 도안이 항상
        // 먼저 채워져 버그가 있어도 테스트가 우연히 통과한다
        Long templateId = insertTemplate("A카드", "서울 5반", "SPECIAL");
        Long poolDesignId = insertPoolDesign(fixture.performanceId(), templateId, 20);
        Long performanceDesignId = insertDesign(fixture.performanceId(), "공연 도안", 50);
        // 공연 도안도 온체인 등록이 돼 있어야 배정 대상이다
        jdbcTemplate.update(
                "UPDATE nft_photocard_designs SET chain_status = 'REGISTERED' WHERE id = ?",
                performanceDesignId);
        // 체인 전송은 이 메서드가 하지 않는다 (카드 행만 PENDING 으로 만든다) — 체인 스텁이 필요 없다
        nftService.issuePhotocardsForSchedule(fixture.performanceDetailId());

        // 뽑기 풀 도안의 재고는 건드려지지 않았다
        assertThat(jdbcTemplate.queryForObject(
                "SELECT issued_supply FROM nft_photocard_designs WHERE id = ?", Integer.class,
                poolDesignId)).isZero();
        // 발급된 카드는 공연 도안에서 나왔다
        assertThat(jdbcTemplate.queryForObject(
                "SELECT design_id FROM nft_photocards LIMIT 1", Long.class))
                .isEqualTo(performanceDesignId);
    }

    @Test
    void 공연_도안을_풀에서_빼면_더_뽑히지_않는다() throws Exception {
        Long userId = insertUser("out@test.com", "제외");
        insertWallet(userId);
        Fixture mine = insertPerformanceFixture();
        Long ticketId = insertTicket(userId, mine);
        Long templateId = insertTemplate("A카드", "서울 5반", "SPECIAL");
        Long designId = insertPoolDesign(mine.performanceId(), templateId, 20);

        mockMvc.perform(patch("/admin/photocard-designs/" + designId + "/draw-pool")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"drawPool":false}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.drawPool").value(false));

        packRepository.save(NftPhotocardPack.grantForTicket(userId, ticketId, mine.performanceDetailId()));
        setPerformanceDatePast(mine.performanceDetailId());

        assertThatThrownBy(() -> writer.draw(userId, UUID.randomUUID()))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", NftErrorCode.DRAW_POOL_EMPTY);
    }

    @Test
    void 이벤트_풀_도안은_풀에서_뺄_수_없다() throws Exception {
        Long templateId = insertTemplate("A카드", "서울 5반", "SPECIAL");
        Long designId = insertPoolDesign(null, templateId, 100);

        // 공연이 없는 도안을 draw_pool = false 로 내리면 CHECK 상 저장이 안 된다.
        // 그 전에 서비스가 막아 준다
        mockMvc.perform(patch("/admin/photocard-designs/" + designId + "/draw-pool")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"drawPool":false}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NFT_048"));
    }

    @Test
    void 소속_등급이_없는_공연_전용_도안은_뽑기_풀로_올릴_수_없다() throws Exception {
        // 🔴 H1: PATCH .../draw-pool 의 true 방향 테스트. 기존 둘은 false 만 봐서 C2 를 못 잡았다.
        // 기존 도안 등록 경로(NftPhotocardDesign.create)로 만든 공연 전용 도안은 group_name·grade
        // 가 둘 다 NULL 이다 — chk_nft_photocard_designs_pool_attrs 가 그 상태로 draw_pool=true 를
        // 거부하므로, 엔티티를 건드리기 전에 서비스가 막아야 한다
        Fixture fixture = insertPerformanceFixture();
        Long designId = insertDesign(fixture.performanceId(), "공연 전용 도안", 50);

        mockMvc.perform(patch("/admin/photocard-designs/" + designId + "/draw-pool")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"drawPool":true}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("NFT_043"));

        // 결과 상태를 DB 에서 확인한다 — draw_pool 이 그대로 false 여야 한다
        assertThat(jdbcTemplate.queryForObject(
                "SELECT draw_pool FROM nft_photocard_designs WHERE id = ?", Boolean.class, designId))
                .isFalse();
    }

    private void givenPinAndChainOk() {
        willReturn("bafyMETA_NEW").given(ipfsPinService).pinJson(anyString(), any());
        willReturn(new PhotocardDesignRegisterResult(
                "PENDING", "0x" + "1".repeat(64), null, null, null))
                .given(chainClient).registerDesign(anyLong(), any(), anyInt(), anyString());
        willReturn("0xcontract").given(chainClient).photocardContractAddress();
    }

    /**
     * 뽑기 풀 도안 한 행을 직접 넣는다. 서비스를 우회하므로 "이미 있는 도안" 이 필요할 때만 쓴다.
     *
     * @param performanceId null 이면 이벤트 풀 도안
     */
    private Long insertPoolDesign(Long performanceId, Long templateId, int totalSupply) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO nft_photocard_designs
                    (performance_general_id, name, image_url, total_supply, image_cid, metadata_cid,
                     chain_status, draw_pool, group_name, grade, template_id)
                VALUES (?, '도안', '/gateway/bafyIMG', ?, 'bafyIMG', 'bafyMETA_' || ?,
                        'REGISTERED', true, '서울 5반', 'SPECIAL'::nft_photocard_grade, ?)
                RETURNING id
                """, Long.class, performanceId, totalSupply, totalSupply, templateId);
    }

    /** 서비스를 우회해 템플릿 한 행. "이미 있는 템플릿" 이 필요할 때 쓴다 */
    private Long insertTemplate(String name, String groupName, String grade) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO nft_photocard_templates
                    (name, description, image_cid, image_url, group_name, grade)
                VALUES (?, '설명', 'bafyIMG_' || ?, '/gateway/bafyIMG', ?, ?::nft_photocard_grade)
                RETURNING id
                """, Long.class, name, name, groupName, grade);
    }

    private String adminToken() {
        Long adminId = insertUser("admin@test.com", "관리자", "ADMIN");
        return "Bearer " + jwtTokenProvider.createAccessToken(adminId, UserRole.ADMIN);
    }
}
