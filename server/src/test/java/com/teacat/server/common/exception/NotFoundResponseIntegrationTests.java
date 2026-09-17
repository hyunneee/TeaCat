package com.teacat.server.common.exception;

import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 없는 경로는 404, 틀린 메서드는 405.
 *
 * <p>단위 테스트({@link GlobalExceptionHandlerTests})는 핸들러를 직접 불러 확인한다. 이 테스트가
 * 따로 있는 이유는 <b>어떤 예외가 실제로 오는지</b>는 스프링이 정하기 때문이다 — 남는 경로를
 * 정적 리소스 핸들러가 받는지, 디스패처가 받는지에 따라 예외 클래스가 갈리고, 그 클래스를
 * 안 잡으면 포괄 핸들러가 삼켜 500 이 나간다. 그건 실제 요청을 흘려봐야만 드러난다.
 *
 * <p>🔴 500 이면 {@code log.error} → Sentry 이슈 + {@code teacat.unexpected.error} 카운터다.
 *    인터넷에 열린 서버는 없는 경로를 하루에 수백 번 두드려 맞는다(봇 스캔).
 */
class NotFoundResponseIntegrationTests extends PostgresIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtTokenProvider jwtTokenProvider;

    @Test
    void 없는_경로는_404_다() throws Exception {
        mockMvc.perform(get("/photocard-designs/그런건없다").header("Authorization", userToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
    }

    /**
     * 봇이 두드리는 주소는 로그인 없이 온다. 인증 체인이 먼저 401 로 끊어 주는 경로가 많지만
     * 공개 경로 아래(`/swagger-ui/**`)는 컨트롤러 단계까지 들어와 여기서 잡혀야 한다.
     */
    @Test
    void 공개_경로_아래의_없는_주소도_404_다() throws Exception {
        mockMvc.perform(get("/swagger-ui/그런건없다.html"))
                .andExpect(status().isNotFound());
    }

    @Test
    void 틀린_메서드는_405_이고_쓸_수_있는_메서드를_알려준다() throws Exception {
        // POST 만 있는 로그인을 GET 으로 부른다 (공개 경로라 인증에 막히지 않는다)
        mockMvc.perform(get("/auth/login"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(header().string("Allow", org.hamcrest.Matchers.containsString("POST")))
                .andExpect(jsonPath("$.success").value(false));
    }

    private String userToken() {
        return "Bearer " + jwtTokenProvider.createAccessToken(
                insertUser("notfound@test.com", "길잃은사람"), UserRole.USER);
    }
}
