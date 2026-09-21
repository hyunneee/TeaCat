package com.teacat.server.sticker.controller;

import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 남의 스티커를 어떻게 거절하는가.
 *
 * <p>🔴 <b>403 이다. 404 가 아니다.</b> 리포의 다른 여덟 도메인이 전부 403 이고
 * ({@code TICKET_002} · {@code PAYMENT_004} · {@code NFT_003} …), 404 의 근거인
 * "존재 누출" 은 여기서 막을 게 없다 — id 가 연번이라 자기 id 간격만 봐도 남의 생성량이 추정된다.
 * 새는 건 상태 코드가 아니라 연번 id 이고, 그건 티켓·결제·포토카드가 이미 똑같이 갖고 있다.
 *
 * <p>다음 사람이 반대로 바꾸면 이 테스트가 걸린다.
 */
class StickerOwnershipIntegrationTests extends PostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private FileStorageService fileStorageService;

    private Long owner;
    private Long stranger;

    @BeforeEach
    void setUp() {
        given(fileStorageService.presignedUrl(anyString())).willReturn("https://minio.test/sticker.png");
        owner = insertUser("sticker-owner@test.com", "주인");
        stranger = insertUser("sticker-stranger@test.com", "남");
    }

    private String tokenFor(Long userId) {
        return "Bearer " + jwtTokenProvider.createAccessToken(userId, UserRole.USER);
    }

    private Long insertJob(Long userId, String status) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO sticker_jobs (user_id, status, idempotency_key, sketch_key, seed)
                VALUES (?, ?, ?, 'sticker/sketch/a.png', 1)
                RETURNING id
                """, Long.class, userId, status, UUID.randomUUID().toString());
    }

    private Long insertSticker(Long userId, Long jobId) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO stickers (job_id, user_id, image_key)
                VALUES (?, ?, 'sticker/result/a.png')
                RETURNING id
                """, Long.class, jobId, userId);
    }

    @Test
    void 남의_작업을_조회하면_403_이다() throws Exception {
        Long jobId = insertJob(owner, "PENDING");

        mockMvc.perform(get("/stickers/jobs/{jobId}", jobId).header("Authorization", tokenFor(stranger)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("STICKER_006"));
    }

    @Test
    void 없는_작업을_조회하면_404_이다() throws Exception {
        mockMvc.perform(get("/stickers/jobs/{jobId}", 999_999L).header("Authorization", tokenFor(owner)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("STICKER_004"));
    }

    @Test
    void 남의_스티커를_지우면_403_이다() throws Exception {
        Long stickerId = insertSticker(owner, insertJob(owner, "DONE"));

        mockMvc.perform(delete("/stickers/{id}", stickerId).header("Authorization", tokenFor(stranger)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("STICKER_006"));
    }

    @Test
    void 없는_스티커를_지우면_404_이다() throws Exception {
        mockMvc.perform(delete("/stickers/{id}", 999_999L).header("Authorization", tokenFor(owner)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("STICKER_005"));
    }

    /** 멱등하게 200 을 주면 프론트 캐시가 틀어진 걸 아무도 모른다 */
    @Test
    void 이미_지운_스티커를_다시_지우면_404_이다() throws Exception {
        Long stickerId = insertSticker(owner, insertJob(owner, "DONE"));

        mockMvc.perform(delete("/stickers/{id}", stickerId).header("Authorization", tokenFor(owner)))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/stickers/{id}", stickerId).header("Authorization", tokenFor(owner)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("STICKER_005"));
    }

    @Test
    void 지운_스티커는_목록에서_빠진다() throws Exception {
        Long stickerId = insertSticker(owner, insertJob(owner, "DONE"));
        insertSticker(owner, insertJob(owner, "DONE"));

        mockMvc.perform(get("/users/me/stickers").header("Authorization", tokenFor(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2));

        mockMvc.perform(delete("/stickers/{id}", stickerId).header("Authorization", tokenFor(owner)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/users/me/stickers").header("Authorization", tokenFor(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    @Test
    void 남의_스티커는_내_목록에_안_나온다() throws Exception {
        insertSticker(owner, insertJob(owner, "DONE"));

        mockMvc.perform(get("/users/me/stickers").header("Authorization", tokenFor(stranger)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    void 로그인하지_않으면_401_이다() throws Exception {
        mockMvc.perform(get("/stickers/quota"))
                .andExpect(status().isUnauthorized());
    }
}
