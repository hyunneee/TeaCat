package com.teacat.server.nft.service;

import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 도감 {@code GET /photocard-designs/draw-pool}.
 *
 * <p>공개된 이벤트·공연 도안을 슬롯으로 깔고 내 보유 상태를 합친다. 미보유 슬롯은 존재와
 * 획득처만 알리고 앞면 정보는 응답부터 가린다.
 */
class PocaDexApiIntegrationTests extends PostgresIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void clearDesigns() {
        jdbcTemplate.update("DELETE FROM nft_photocards");
        jdbcTemplate.update("DELETE FROM nft_photocard_designs");
    }

    @Test
    void 미보유_도안은_앞면_정보를_받지_않는다() throws Exception {
        insertDrawPoolDesign("김예린", 100, "서울 5반 · 코치", "SPECIAL");

        mockMvc.perform(get("/photocard-designs/draw-pool").header("Authorization", userToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cards.length()").value(1))
                .andExpect(jsonPath("$.data.cards[0].designId").isNumber())
                .andExpect(jsonPath("$.data.cards[0].owned").value(false))
                .andExpect(jsonPath("$.data.cards[0].name").doesNotExist())
                .andExpect(jsonPath("$.data.cards[0].imageUrl").doesNotExist())
                .andExpect(jsonPath("$.data.cards[0].group").doesNotExist())
                .andExpect(jsonPath("$.data.cards[0].grade").doesNotExist())
                .andExpect(jsonPath("$.data.cards[0].acquisition.type").value("EVENT"))
                .andExpect(jsonPath("$.data.cards[0].acquisition.name").value("이벤트 포토카드 팩"))
                .andExpect(jsonPath("$.data.cards[0].count").value(0))
                .andExpect(jsonPath("$.data.cards[0].photocardId").doesNotExist());
    }

    @Test
    void 보유_도안은_앞면과_보유_상태를_받는다() throws Exception {
        Long userId = insertUser("dex-owner@test.com", "도감주인");
        Long designId = insertDrawPoolDesign("김예린", 100, "서울 5반 · 코치", "SPECIAL");
        Long photocardId = insertPhotocard(designId, null, userId);
        jdbcTemplate.update("UPDATE nft_photocards SET status = 'MINTED' WHERE id = ?", photocardId);

        mockMvc.perform(get("/photocard-designs/draw-pool").header("Authorization", tokenFor(userId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cards[0].owned").value(true))
                .andExpect(jsonPath("$.data.cards[0].name").value("김예린"))
                .andExpect(jsonPath("$.data.cards[0].imageUrl").value("/draw.png"))
                .andExpect(jsonPath("$.data.cards[0].group").value("서울 5반 · 코치"))
                .andExpect(jsonPath("$.data.cards[0].grade").value("SPECIAL"))
                .andExpect(jsonPath("$.data.cards[0].count").value(1))
                .andExpect(jsonPath("$.data.cards[0].photocardId").value(photocardId))
                .andExpect(jsonPath("$.data.pendingCount").value(0));
    }

    /** 🔴 이 엔드포인트를 따로 만든 이유. 남은 수량을 보고 뽑기 시점을 고르게 두지 않는다 */
    @Test
    void 운영_정보는_내려가지_않는다() throws Exception {
        insertDrawPoolDesign("김예린", 100, "서울 5반 · 코치", "SPECIAL");

        mockMvc.perform(get("/photocard-designs/draw-pool").header("Authorization", userToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cards[0].remaining").doesNotExist())
                .andExpect(jsonPath("$.data.cards[0].totalSupply").doesNotExist())
                .andExpect(jsonPath("$.data.cards[0].issuedSupply").doesNotExist())
                .andExpect(jsonPath("$.data.cards[0].imageCid").doesNotExist())
                .andExpect(jsonPath("$.data.cards[0].metadataCid").doesNotExist())
                .andExpect(jsonPath("$.data.cards[0].chainStatus").doesNotExist());
    }

    @Test
    void 공개된_공연_도안은_슬롯에_들어가고_미공개_공연은_빠진다() throws Exception {
        Fixture visible = insertPerformanceFixture();
        Long visibleDesignId = insertRegisteredPerformanceDesign(visible.performanceId(), "공개 공연 카드");
        Fixture future = insertPerformanceFixture();
        Long futureDesignId = insertRegisteredPerformanceDesign(future.performanceId(), "공개 전 카드");
        jdbcTemplate.update("UPDATE performance_general SET visible_from = CURRENT_DATE + 1 WHERE id = ?",
                future.performanceId());
        Fixture hidden = insertPerformanceFixture();
        Long hiddenDesignId = insertRegisteredPerformanceDesign(hidden.performanceId(), "비공개 카드");
        jdbcTemplate.update("UPDATE performance_general SET hidden_at = now() WHERE id = ?", hidden.performanceId());
        Long eventDesignId = insertDrawPoolDesign("이벤트 카드", 100, "서울 5반 · 코치", "SPECIAL");

        mockMvc.perform(get("/photocard-designs/draw-pool").header("Authorization", userToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cards.length()").value(2))
                .andExpect(jsonPath("$.data.cards[0].designId").value(visibleDesignId))
                .andExpect(jsonPath("$.data.cards[0].acquisition.type").value("PERFORMANCE"))
                .andExpect(jsonPath("$.data.cards[0].acquisition.name").value("테스트 공연"))
                .andExpect(jsonPath("$.data.cards[1].designId").value(eventDesignId))
                .andExpect(jsonPath("$.data.cards[1].acquisition.type").value("EVENT"))
                .andExpect(jsonPath("$.data.cards[1].acquisition.name").value("이벤트 포토카드 팩"))
                .andExpect(jsonPath("$.data.cards[?(@.designId == %s)]".formatted(futureDesignId)).isEmpty())
                .andExpect(jsonPath("$.data.cards[?(@.designId == %s)]".formatted(hiddenDesignId)).isEmpty());
    }

    @Test
    void 이미_가진_도안은_공연이_비공개여도_도감에_남는다() throws Exception {
        Long userId = insertUser("private-owner@test.com", "비공개카드주인");
        Fixture fixture = insertPerformanceFixture();
        Long designId = insertRegisteredPerformanceDesign(fixture.performanceId(), "내 공연 카드");
        jdbcTemplate.update("UPDATE performance_general SET hidden_at = now() WHERE id = ?", fixture.performanceId());
        insertPhotocard(designId, insertTicket(userId, fixture), userId);

        mockMvc.perform(get("/photocard-designs/draw-pool").header("Authorization", tokenFor(userId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cards.length()").value(1))
                .andExpect(jsonPath("$.data.cards[0].designId").value(designId))
                .andExpect(jsonPath("$.data.cards[0].owned").value(true))
                .andExpect(jsonPath("$.data.cards[0].name").value("내 공연 카드"));
    }

    /**
     * 🔴 <b>온체인 등록이 끝나지 않은 도안은 도감에 들어가지 않는다.</b>
     *
     * <p>뽑기는 {@code chain_status = 'REGISTERED'} 인 도안만 고른다(뽑기 후보 쿼리). 미등록
     * 도안을 도감에 실으면 <b>영영 채워지지 않는 물음표 칸</b>이 생기고, 사용자는 이유도
     * 모르고 계속 뽑는다. 도감의 조건은 뽑기의 조건과 같아야 한다.
     */
    @Test
    void 온체인_등록_전_도안은_도감에_들어가지_않는다() throws Exception {
        insertDrawPoolDesign("등록된카드", 100, "서울 5반 · 코치", "SPECIAL");
        insertPendingDrawPoolDesign("등록중인카드", "서울 5반 · 교육생");

        mockMvc.perform(get("/photocard-designs/draw-pool").header("Authorization", userToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cards.length()").value(1))
                .andExpect(jsonPath("$.data.cards[0].designId").isNumber());
    }

    @Test
    void 비로그인은_거절한다() throws Exception {
        insertDrawPoolDesign("김예린", 100, "서울 5반 · 코치", "SPECIAL");

        mockMvc.perform(get("/photocard-designs/draw-pool"))
                .andExpect(status().isUnauthorized());
    }

    /**
     * 🔴 도감은 <b>도안 ID</b> 로 보유 여부를 맞춥니다. 이름으로 맞추면 어드민이 도안 이름을
     * 바꾸는 순간 도감의 보유 표시가 통째로 어긋납니다 — 이름은 표시용일 뿐입니다.
     */
    @Test
    void 내_포카_응답에_도안_ID_가_실린다() throws Exception {
        Long userId = insertUser("dex-owner@test.com", "도감주인");
        Long designId = insertDrawPoolDesign("김예린", 100, "서울 5반 · 코치", "SPECIAL");
        insertPhotocard(designId, null, userId);

        mockMvc.perform(get("/users/me/photocards")
                        .header("Authorization", tokenFor(userId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].designId").value(designId));
    }

    /** 아직 체인에 올리지 않은 뽑기 풀 도안 (`insertDrawPoolDesign` 은 REGISTERED 로 넣는다) */
    private void insertPendingDrawPoolDesign(String name, String groupName) {
        jdbcTemplate.update("""
                INSERT INTO nft_photocard_designs
                    (performance_general_id, name, image_url, total_supply, draw_pool,
                     chain_status, group_name, grade)
                VALUES (NULL, ?, '/pending.png', 100, true,
                        'PENDING', ?, 'COMMON'::nft_photocard_grade)
                """, name, groupName);
    }

    private Long insertRegisteredPerformanceDesign(Long performanceId, String name) {
        Long designId = insertDesign(performanceId, name, 50);
        jdbcTemplate.update("UPDATE nft_photocard_designs SET chain_status = 'REGISTERED' WHERE id = ?", designId);
        return designId;
    }

    private String userToken() {
        return tokenFor(insertUser("dex-viewer@test.com", "도감보는사람"));
    }

    private String tokenFor(Long userId) {
        return "Bearer " + jwtTokenProvider.createAccessToken(userId, UserRole.USER);
    }
}
