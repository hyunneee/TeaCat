package com.teacat.server.sticker.controller;

import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 🔴 <b>서버에 내부 키가 설정돼 있지 않을 때.</b>
 *
 * <p>"비었으면 통과" 로 만들면 운영에 키를 안 넣은 실수가 곧 <b>열린 API</b> 다.
 * {@code /internal/**} 은 스프링 시큐리티를 그냥 지나가므로 이 컨트롤러가 유일한 문이다.
 *
 * <p>빈 헤더로 부르는 쪽도, 아무 값이나 넣는 쪽도 모두 막혀야 한다 —
 * 빈 키와 빈 헤더가 "같다" 고 판정되면 헤더를 비워 보내는 것만으로 통과한다.
 */
@TestPropertySource(properties = "sticker.internal-api-key=")
class StickerWorkerKeyMissingIntegrationTests extends PostgresIntegrationTest {

    private static final String KEY_HEADER = "X-Internal-Api-Key";

    @Autowired
    private MockMvc mockMvc;

    /* 실물 FileStorageService 는 뜰 때 MinIO 에 붙어 버킷을 확인한다. 여기서는 저장소를
       한 번도 쓰지 않으므로 목으로 갈아끼워 MinIO 없이도 돌게 한다 */
    @MockitoBean
    private FileStorageService fileStorageService;

    @Test
    void 키가_미설정이면_헤더_없이도_막힌다() throws Exception {
        mockMvc.perform(get("/internal/ai-jobs/next"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("STICKER_007"));
    }

    @Test
    void 키가_미설정이면_빈_헤더로도_막힌다() throws Exception {
        mockMvc.perform(get("/internal/ai-jobs/next").header(KEY_HEADER, ""))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("STICKER_007"));
    }

    @Test
    void 키가_미설정이면_아무_값이나_넣어도_막힌다() throws Exception {
        mockMvc.perform(get("/internal/ai-jobs/next").header(KEY_HEADER, "아무거나"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("STICKER_007"));
    }

    @Test
    void 결과_올리기도_막힌다() throws Exception {
        mockMvc.perform(post("/internal/ai-jobs/{id}/complete", 1L)
                        .header(KEY_HEADER, "")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"imageBase64\":\"aaaa\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("STICKER_007"));
    }
}
