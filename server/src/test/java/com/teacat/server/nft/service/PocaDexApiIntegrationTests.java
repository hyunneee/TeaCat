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
 * <p>"내 포토카드" 를 도감으로 그리려면 <b>가진 것 말고 전체</b>가 필요하다. 그 전체를 주는
 * API 가 어드민용밖에 없어서 사용자용으로 하나 열었다.
 *
 * <p>🔴 이 테스트가 지키는 것은 <b>무엇이 나가지 않는가</b>이다 — 남은 수량·CID·체인 상태는
 * 운영 정보이고, 공연 좌석 도안은 아직 열리지 않은 공연의 카드를 미리 보여주는 셈이 된다.
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
    void 로그인한_회원은_도감_목록을_받는다() throws Exception {
        insertDrawPoolDesign("김예린", 100, "서울 5반 · 코치", "SPECIAL");

        mockMvc.perform(get("/photocard-designs/draw-pool").header("Authorization", userToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].designId").isNumber())
                .andExpect(jsonPath("$.data[0].name").value("김예린"))
                .andExpect(jsonPath("$.data[0].imageUrl").value("/draw.png"))
                // 역할(코치·교육생·개발자)은 화면이 이 꼬리표에서 읽습니다
                .andExpect(jsonPath("$.data[0].group").value("서울 5반 · 코치"))
                .andExpect(jsonPath("$.data[0].grade").value("SPECIAL"));
    }

    /** 🔴 이 엔드포인트를 따로 만든 이유. 남은 수량을 보고 뽑기 시점을 고르게 두지 않는다 */
    @Test
    void 운영_정보는_내려가지_않는다() throws Exception {
        insertDrawPoolDesign("김예린", 100, "서울 5반 · 코치", "SPECIAL");

        mockMvc.perform(get("/photocard-designs/draw-pool").header("Authorization", userToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].remaining").doesNotExist())
                .andExpect(jsonPath("$.data[0].totalSupply").doesNotExist())
                .andExpect(jsonPath("$.data[0].issuedSupply").doesNotExist())
                .andExpect(jsonPath("$.data[0].imageCid").doesNotExist())
                .andExpect(jsonPath("$.data[0].metadataCid").doesNotExist())
                .andExpect(jsonPath("$.data[0].chainStatus").doesNotExist());
    }

    /**
     * 🔴 공연 좌석에서 나오는 도안은 담기지 않는다. 담으면 <b>아직 열리지도 않은 공연의
     * 카드가 도감에 미리 보입니다</b> — 무엇이 나올지가 먼저 새어 나갑니다.
     */
    @Test
    void 공연_좌석_도안은_도감에_들어가지_않는다() throws Exception {
        Fixture fixture = insertPerformanceFixture();
        insertDesign(fixture.performanceId(), "공연 한정 카드", 50);
        insertDrawPoolDesign("김예린", 100, "서울 5반 · 코치", "SPECIAL");

        mockMvc.perform(get("/photocard-designs/draw-pool").header("Authorization", userToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].name").value("김예린"));
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

    private String userToken() {
        return tokenFor(insertUser("dex-viewer@test.com", "도감보는사람"));
    }

    private String tokenFor(Long userId) {
        return "Bearer " + jwtTokenProvider.createAccessToken(userId, UserRole.USER);
    }
}
