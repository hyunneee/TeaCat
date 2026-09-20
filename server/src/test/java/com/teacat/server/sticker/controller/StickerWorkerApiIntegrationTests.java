package com.teacat.server.sticker.controller;

import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 워커 API. <b>노트북의 계약</b>이므로 경로·헤더·필드 이름까지 여기서 못 박는다 —
 * 여기서 안 박으면 캠퍼스에서 GPU 앞에 앉아서야 알게 된다.
 *
 * <p>🔴 키 검사도 여기서 지킨다. {@code SecurityConfig} 의 {@code /internal/**} 은
 * 스프링 시큐리티를 통과시키므로, 컨트롤러가 키를 안 보면 그 순간 인터넷에 열린 API 가 된다.
 * 그 자리에 달린 경고를 사람 기억이 아니라 이 테스트가 지킨다.
 */
@TestPropertySource(properties = "sticker.internal-api-key=test-internal-key")
class StickerWorkerApiIntegrationTests extends PostgresIntegrationTest {

    private static final String KEY_HEADER = "X-Internal-Api-Key";
    private static final String KEY = "test-internal-key";
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};
    private static final String PNG_BASE64 = Base64.getEncoder().encodeToString(PNG);

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private FileStorageService fileStorageService;

    @BeforeEach
    void stubStorage() {
        given(fileStorageService.download(anyString())).willReturn(PNG);
        given(fileStorageService.uploadBytes(any(), any(), any())).willReturn("sticker/result/a.png");
    }

    private Long insertJob(Long userId, String status, String subject, int seed) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO sticker_jobs (user_id, status, idempotency_key, sketch_key, subject, seed, claimed_at)
                VALUES (?, ?, ?, 'sticker/sketch/a.png', ?, ?, now())
                RETURNING id
                """, Long.class, userId, status, UUID.randomUUID().toString(), subject, seed);
    }

    private String statusOf(Long jobId) {
        return jdbcTemplate.queryForObject("SELECT status FROM sticker_jobs WHERE id = ?", String.class, jobId);
    }

    private int stickerCount() {
        return jdbcTemplate.queryForObject("SELECT count(*)::int FROM stickers", Integer.class);
    }

    /* ── 키 검사 ─────────────────────────────────────────────────── */

    @Test
    void 키가_없으면_401_이다() throws Exception {
        mockMvc.perform(get("/internal/ai-jobs/next"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("STICKER_007"));
    }

    @Test
    void 키가_틀리면_401_이다() throws Exception {
        mockMvc.perform(get("/internal/ai-jobs/next").header(KEY_HEADER, "wrong-key"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("STICKER_007"));
    }

    @Test
    void 결과_올리기도_키를_본다() throws Exception {
        Long jobId = insertJob(insertUser("w1@test.com", "워커1"), "RUNNING", null, 1);

        mockMvc.perform(post("/internal/ai-jobs/{id}/complete", jobId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"imageBase64\":\"" + PNG_BASE64 + "\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("STICKER_007"));

        assertThat(statusOf(jobId)).isEqualTo("RUNNING");
    }

    @Test
    void 실패_신고도_키를_본다() throws Exception {
        Long jobId = insertJob(insertUser("w2@test.com", "워커2"), "RUNNING", null, 1);

        mockMvc.perform(post("/internal/ai-jobs/{id}/fail", jobId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"boom\"}"))
                .andExpect(status().isUnauthorized());

        assertThat(statusOf(jobId)).isEqualTo("RUNNING");
    }

    /* ── 일감 받기 ───────────────────────────────────────────────── */

    @Test
    void 기다리는_작업이_없으면_204_다() throws Exception {
        mockMvc.perform(get("/internal/ai-jobs/next").header(KEY_HEADER, KEY))
                .andExpect(status().isNoContent());
    }

    /**
     * 🔴 노트북이 읽는 모양 그대로다. 봉투({@code data})와 네 필드 이름이 계약이다 —
     * 바꾸면 노트북도 고쳐야 한다.
     */
    @Test
    void 일감은_봉투_안에_jobId_sketchBase64_subject_seed_로_온다() throws Exception {
        Long userId = insertUser("w3@test.com", "워커3");
        Long jobId = insertJob(userId, "PENDING", "고양이", 777);

        mockMvc.perform(get("/internal/ai-jobs/next")
                        .header(KEY_HEADER, KEY)
                        .header("X-Worker-Id", "gpu-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.jobId").value(jobId))
                .andExpect(jsonPath("$.data.sketchBase64").value(PNG_BASE64))
                .andExpect(jsonPath("$.data.subject").value("고양이"))
                .andExpect(jsonPath("$.data.seed").value(777));

        assertThat(statusOf(jobId)).isEqualTo("RUNNING");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT worker_id FROM sticker_jobs WHERE id = ?", String.class, jobId)).isEqualTo("gpu-01");
    }

    @Test
    void 워커_식별자를_안_보내도_집어간다() throws Exception {
        Long jobId = insertJob(insertUser("w4@test.com", "워커4"), "PENDING", null, 1);

        mockMvc.perform(get("/internal/ai-jobs/next").header(KEY_HEADER, KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.jobId").value(jobId));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT worker_id FROM sticker_jobs WHERE id = ?", String.class, jobId)).isEqualTo("unknown");
    }

    /* ── 결과 올리기 ─────────────────────────────────────────────── */

    @Test
    void 결과를_올리면_DONE_이_되고_스티커가_생긴다() throws Exception {
        Long userId = insertUser("w5@test.com", "워커5");
        Long jobId = insertJob(userId, "RUNNING", null, 1);

        mockMvc.perform(post("/internal/ai-jobs/{id}/complete", jobId)
                        .header(KEY_HEADER, KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"imageBase64\":\"" + PNG_BASE64 + "\",\"meta\":{\"seed\":42,\"secs\":7}}"))
                .andExpect(status().isOk());

        assertThat(statusOf(jobId)).isEqualTo("DONE");
        assertThat(stickerCount()).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT params_json ->> 'seed' FROM sticker_jobs WHERE id = ?", String.class, jobId))
                .isEqualTo("42");
    }

    @Test
    void meta_없이_올려도_된다() throws Exception {
        Long jobId = insertJob(insertUser("w6@test.com", "워커6"), "RUNNING", null, 1);

        mockMvc.perform(post("/internal/ai-jobs/{id}/complete", jobId)
                        .header(KEY_HEADER, KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"imageBase64\":\"" + PNG_BASE64 + "\"}"))
                .andExpect(status().isOk());

        assertThat(statusOf(jobId)).isEqualTo("DONE");
    }

    /** 워커가 응답을 못 받고 다시 보낸 경우다. 에러가 아니고, 스티커가 두 장 생겨서도 안 된다 */
    @Test
    void 같은_결과를_두_번_올려도_스티커는_한_장이다() throws Exception {
        Long jobId = insertJob(insertUser("w7@test.com", "워커7"), "RUNNING", null, 1);
        String body = "{\"imageBase64\":\"" + PNG_BASE64 + "\"}";

        mockMvc.perform(post("/internal/ai-jobs/{id}/complete", jobId)
                        .header(KEY_HEADER, KEY).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
        mockMvc.perform(post("/internal/ai-jobs/{id}/complete", jobId)
                        .header(KEY_HEADER, KEY).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());

        assertThat(stickerCount()).isEqualTo(1);
    }

    /** 스위퍼가 되돌린 사이에 늦게 도착한 결과 */
    @Test
    void 집어가지_않은_작업에_결과를_올리면_409_다() throws Exception {
        Long jobId = insertJob(insertUser("w8@test.com", "워커8"), "PENDING", null, 1);

        mockMvc.perform(post("/internal/ai-jobs/{id}/complete", jobId)
                        .header(KEY_HEADER, KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"imageBase64\":\"" + PNG_BASE64 + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STICKER_008"));

        assertThat(stickerCount()).isZero();
    }

    @Test
    void 결과가_PNG_가_아니면_400_이다() throws Exception {
        Long jobId = insertJob(insertUser("w9@test.com", "워커9"), "RUNNING", null, 1);
        String notPng = Base64.getEncoder().encodeToString("그냥 글자".getBytes());

        mockMvc.perform(post("/internal/ai-jobs/{id}/complete", jobId)
                        .header(KEY_HEADER, KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"imageBase64\":\"" + notPng + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("STICKER_009"));

        assertThat(statusOf(jobId)).isEqualTo("RUNNING");
    }

    /* ── 실패 신고 ───────────────────────────────────────────────── */

    /**
     * 🔴 컬럼에는 <b>코드</b>가 들어간다. 워커가 보낸 문장이 아니다 —
     * 프론트는 failReason 을 코드로 다루고, 워커 메시지에는 경로·모델명 같은 내부 사정이 섞인다.
     */
    @Test
    void 실패를_신고하면_FAILED_가_되고_사유는_코드로_남는다() throws Exception {
        Long jobId = insertJob(insertUser("w10@test.com", "워커10"), "RUNNING", null, 1);

        mockMvc.perform(post("/internal/ai-jobs/{id}/fail", jobId)
                        .header(KEY_HEADER, KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"CUDA out of memory at /workspace/models/qwen/pipeline.py line 220\"}"))
                .andExpect(status().isOk());

        assertThat(statusOf(jobId)).isEqualTo("FAILED");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT fail_reason FROM sticker_jobs WHERE id = ?", String.class, jobId))
                .isEqualTo("WORKER_ERROR");
    }

    @Test
    void 이미_끝난_작업의_실패_신고는_무시한다() throws Exception {
        Long jobId = insertJob(insertUser("w11@test.com", "워커11"), "DONE", null, 1);

        mockMvc.perform(post("/internal/ai-jobs/{id}/fail", jobId)
                        .header(KEY_HEADER, KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"늦게 온 신고\"}"))
                .andExpect(status().isOk());

        assertThat(statusOf(jobId)).isEqualTo("DONE");
    }

    @Test
    void 없는_작업이면_404_다() throws Exception {
        mockMvc.perform(post("/internal/ai-jobs/{id}/fail", 999_999L)
                        .header(KEY_HEADER, KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"boom\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("STICKER_004"));
    }
}
