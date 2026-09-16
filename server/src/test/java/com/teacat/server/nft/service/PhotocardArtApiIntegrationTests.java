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
 * 카드 그림 목록 {@code GET /photocard-templates}.
 *
 * <p>같은 목록을 보는 어드민 API 가 이미 있는데 <b>왜 하나를 더 열었나</b> — 어드민 API 는
 * {@code /admin/**} 이라 ADMIN 이 아니면 403 이고, 일반 화면(캣머니 게임)이 카드 그림을
 * 쓸 방법이 없었다. 마켓 목록은 <b>판매 중인 카드</b>라 아무도 안 올리면 0장이다.
 *
 * <p>🔴 이 테스트가 지키는 것은 <b>무엇이 나가지 않는가</b>이다. 어드민 응답에는
 * {@code hidden} · {@code usedCount}(발행 수) · {@code createdAt} 이 들어 있고, DTO 를
 * 재사용했다면 그게 그대로 사용자에게 나갔을 것이다. 나중에 운영용 필드를 하나 더
 * 붙였을 때 조용히 새는 것을 여기서 막는다.
 */
class PhotocardArtApiIntegrationTests extends PostgresIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void clearTemplates() {
        jdbcTemplate.update("DELETE FROM nft_photocard_templates");
    }

    @Test
    void 로그인한_회원은_카드_그림_목록을_받는다() throws Exception {
        insertTemplate("김예린", false);
        insertTemplate("박준호", false);

        mockMvc.perform(get("/photocard-templates").header("Authorization", userToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                // 최신순이라 나중에 넣은 쪽이 먼저다
                .andExpect(jsonPath("$.data[0].name").value("박준호"))
                .andExpect(jsonPath("$.data[0].imageUrl").value("/gateway/bafy박준호"))
                .andExpect(jsonPath("$.data[0].templateId").isNumber());
    }

    /** 🔴 이 엔드포인트를 따로 만든 이유. 운영 정보는 한 칸도 나가지 않는다 */
    @Test
    void 운영_정보는_내려가지_않는다() throws Exception {
        insertTemplate("김예린", false);

        mockMvc.perform(get("/photocard-templates").header("Authorization", userToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].hidden").doesNotExist())
                .andExpect(jsonPath("$.data[0].usedCount").doesNotExist())
                .andExpect(jsonPath("$.data[0].createdAt").doesNotExist())
                .andExpect(jsonPath("$.data[0].description").doesNotExist());
    }

    /** 감추기는 "새로 고르지 못하게" 하는 것이라 이 목록에서도 빠져야 한다 */
    @Test
    void 감춘_그림은_빠진다() throws Exception {
        insertTemplate("보이는카드", false);
        insertTemplate("감춘카드", true);

        mockMvc.perform(get("/photocard-templates").header("Authorization", userToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].name").value("보이는카드"));
    }

    /** {@code /admin} 밖이지만 공개 경로는 아니다 — SecurityConfig 의 anyRequest().authenticated() */
    @Test
    void 비로그인은_거절한다() throws Exception {
        insertTemplate("김예린", false);

        mockMvc.perform(get("/photocard-templates"))
                .andExpect(status().isUnauthorized());
    }

    private String userToken() {
        Long userId = insertUser("art-viewer@test.com", "그림보는사람");
        return "Bearer " + jwtTokenProvider.createAccessToken(userId, UserRole.USER);
    }

    private void insertTemplate(String name, boolean hidden) {
        jdbcTemplate.update("""
                INSERT INTO nft_photocard_templates
                    (name, description, image_cid, image_url, group_name, grade, hidden)
                VALUES (?, '운영자만 보는 설명', 'bafyIMG_' || ?, '/gateway/bafy' || ?,
                        '서울 5반', 'COMMON'::nft_photocard_grade, ?)
                """, name, name, name, hidden);
    }
}
