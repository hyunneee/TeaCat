package com.teacat.server.nft.service;

import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * {@code GET /users/me/photocards/by-design/{designId}} — 내가 가진 같은 도안 카드들.
 *
 * <p>도감이 같은 도안을 한 칸으로 묶어 {@code ×3} 으로 보여주므로, 상세에서 "그 셋이 각각
 * 어디서 온 것인가" 와 "어느 장을 팔 것인가" 를 물을 곳이 필요하다.
 *
 * <p>🔴 이 테스트가 지키는 것은 두 가지다 — <b>남의 카드가 새지 않는가</b>, 그리고
 * <b>장마다 좌석·회차·판매 상태가 따로 실리는가</b>(하나만 실리면 어느 장을 파는지 못 고른다).
 */
class MyDesignCopiesApiIntegrationTests extends PostgresIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtTokenProvider jwtTokenProvider;

    @Test
    void 같은_도안_카드를_발행_순서로_모두_돌려준다() throws Exception {
        Long userId = insertUser("copies@test.com", "여러장주인");
        Fixture fixture = insertPerformanceFixture();
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 10);
        Long first = insertPhotocard(designId, insertTicket(userId, fixture), userId);
        Long second = insertPhotocard(designId, insertTicket(userId, fixture), userId);

        mockMvc.perform(get("/users/me/photocards/by-design/" + designId)
                        .header("Authorization", tokenFor(userId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].photocardId").value(first))
                .andExpect(jsonPath("$.data[1].photocardId").value(second));
    }

    /** 이 값들이 장마다 달라서 사용자가 "어느 장" 인지 알아본다 */
    @Test
    void 장마다_좌석과_회차가_실린다() throws Exception {
        Long userId = insertUser("seat@test.com", "좌석주인");
        Fixture fixture = insertPerformanceFixture();
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 10);
        insertPhotocard(designId, insertTicket(userId, fixture), userId);

        mockMvc.perform(get("/users/me/photocards/by-design/" + designId)
                        .header("Authorization", tokenFor(userId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].origin.areaCode").value("A"))
                .andExpect(jsonPath("$.data[0].origin.seatGrade").value("VIP"))
                // 🔴 내 카드만 나오는 목록이라 열·번을 가리지 않는다. 남의 카드 상세에서 가리는 것과 다르다
                .andExpect(jsonPath("$.data[0].origin.rowLabel").value("3"))
                .andExpect(jsonPath("$.data[0].origin.seatNumber").isNumber())
                .andExpect(jsonPath("$.data[0].performanceNum").value(1))
                .andExpect(jsonPath("$.data[0].performanceDate").exists())
                .andExpect(jsonPath("$.data[0].issuedAt").exists());
    }

    /** 뽑기 카드는 티켓이 없다. 좌석·회차가 없다고 행이 빠지면 도감에서 센 장수와 어긋난다 */
    @Test
    void 뽑기로_얻은_카드도_좌석_없이_실린다() throws Exception {
        Long userId = insertUser("draw@test.com", "뽑기주인");
        Long designId = insertDrawPoolDesign("김예린", 100, "서울 5반 · 코치", "SPECIAL");
        insertPhotocard(designId, null, userId);

        mockMvc.perform(get("/users/me/photocards/by-design/" + designId)
                        .header("Authorization", tokenFor(userId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].origin").value((Object) null))
                .andExpect(jsonPath("$.data[0].performanceNum").value((Object) null));
    }

    @Test
    void 남의_카드는_같은_도안이어도_나오지_않는다() throws Exception {
        Long mine = insertUser("mine@test.com", "나");
        Long other = insertUser("other@test.com", "남");
        Fixture fixture = insertPerformanceFixture();
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 10);
        insertPhotocard(designId, insertTicket(other, fixture), other);

        mockMvc.perform(get("/users/me/photocards/by-design/" + designId)
                        .header("Authorization", tokenFor(mine)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    /**
     * 판매 중인 장은 또 팔 수 없다. 장마다 이 값이 실려야 화면이 그 장을 빼거나 잠근다 —
     * 목록 전체에 하나만 있으면 세 장 중 어느 것이 나가 있는지 알 수 없다.
     */
    @Test
    void 판매_중인_장에만_판매_상태가_실린다() throws Exception {
        Long userId = insertFundedUser("listed@test.com", "판매중주인", 0);
        Fixture fixture = insertPerformanceFixture();
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 10);
        Long listedCard = insertPhotocard(designId, insertTicket(userId, fixture), userId);
        insertPhotocard(designId, insertTicket(userId, fixture), userId);
        jdbcTemplate.update("""
                INSERT INTO nft_photocard_listings (photocard_id, seller_id, price, description, status)
                VALUES (?, ?, 1000, '', 'ACTIVE')
                """, listedCard, userId);

        mockMvc.perform(get("/users/me/photocards/by-design/" + designId)
                        .header("Authorization", tokenFor(userId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].marketType").value("FIXED_PRICE"))
                .andExpect(jsonPath("$.data[0].marketStatus").value("ACTIVE"))
                .andExpect(jsonPath("$.data[1].marketType").value((Object) null));
    }

    @Test
    void 비로그인은_거절한다() throws Exception {
        mockMvc.perform(get("/users/me/photocards/by-design/1"))
                .andExpect(status().isUnauthorized());
    }

    /** 상세 응답이 designId 를 줘야 이 목록을 물을 수 있다 */
    @Test
    void 상세_응답에_도안_ID_가_실린다() throws Exception {
        Long userId = insertUser("detail@test.com", "상세주인");
        Fixture fixture = insertPerformanceFixture();
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 10);
        Long photocardId = insertPhotocard(designId, insertTicket(userId, fixture), userId);

        mockMvc.perform(get("/photocards/" + photocardId)
                        .header("Authorization", tokenFor(userId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.designId").value(designId));
    }

    private String tokenFor(Long userId) {
        return "Bearer " + jwtTokenProvider.createAccessToken(userId, UserRole.USER);
    }
}
