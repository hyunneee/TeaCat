package com.teacat.server.common.exception;

import com.teacat.server.common.response.BaseResponse;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.HttpMethod;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 잘못 보낸 요청을 500 으로 내보내지 않는다.
 *
 * <p>프론트는 5xx 를 서버 장애로 보고 재시도한다. 클라이언트가 고쳐야 하는 요청에
 * 500 을 주면 고칠 수 없는 요청을 계속 두드리게 된다.
 */
class GlobalExceptionHandlerTests {

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler(registry);

    @Test
    void 경로_파라미터_형식이_틀리면_400_이다() {
        // 지워진 화면의 옛 링크가 남아 `/concerts/new` 로 들어오던 경우다 (id 자리에 "new")
        ResponseEntity<BaseResponse<Void>> response =
                handler.handleTypeMismatch(mismatch("concertId", "new"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isFalse();
    }

    @Test
    void 어느_파라미터가_문제인지_알려준다() {
        ResponseEntity<BaseResponse<Void>> response =
                handler.handleTypeMismatch(mismatch("size", "abc"));

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getMessage()).contains("size");
    }

    @Test
    void 보낸_값과_내부_타입은_응답에_담지_않는다() {
        // 값에는 사용자 입력이, 타입에는 내부 구조가 섞인다. 자세한 건 로그에만 남긴다
        ResponseEntity<BaseResponse<Void>> response =
                handler.handleTypeMismatch(mismatch("concertId", "<script>alert(1)</script>"));

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getMessage())
                .doesNotContain("script")
                .doesNotContain("Long");
    }

    /**
     * 없는 경로는 404 다. 이게 500 으로 나가면 {@code log.error} → Sentry 이슈가 열리고
     * {@code teacat.unexpected.error} 카운터가 봇 스캔으로 오염된다 — 1건도 알림 대상인 지표다.
     *
     * <p>어떤 예외가 실제로 오는지는 스프링이 정하므로, 그건
     * {@code NotFoundResponseIntegrationTests} 가 실제 요청으로 확인한다.
     */
    @Test
    void 없는_경로는_404_다() {
        ResponseEntity<BaseResponse<Void>> response = handler.handleNotFound(
                new NoResourceFoundException(HttpMethod.GET, "/wp-login.php", "/api/wp-login.php"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isFalse();
    }

    @Test
    void 없는_경로는_장애_카운터를_올리지_않는다() {
        handler.handleNotFound(new NoResourceFoundException(HttpMethod.GET, "/.env", "/api/.env"));

        assertThat(registry.find("teacat.unexpected.error").counter()).isNull();
    }

    @Test
    void 틀린_메서드는_405_이고_쓸_수_있는_메서드를_알려준다() {
        ResponseEntity<BaseResponse<Void>> response = handler.handleMethodNotAllowed(
                new HttpRequestMethodNotSupportedException("GET", Set.of("POST")));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.METHOD_NOT_ALLOWED);
        assertThat(response.getHeaders().getAllow()).containsExactly(HttpMethod.POST);
    }

    /** 스프링이 허용 메서드를 안 알려주는 경우가 있다. Allow 를 빼고 405 만 준다 */
    @Test
    void 허용_메서드를_모르면_Allow_없이_405_다() {
        ResponseEntity<BaseResponse<Void>> response = handler.handleMethodNotAllowed(
                new HttpRequestMethodNotSupportedException("GET"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.METHOD_NOT_ALLOWED);
        assertThat(response.getHeaders().getAllow()).isEmpty();
    }

    private MethodArgumentTypeMismatchException mismatch(String name, Object value) {
        return new MethodArgumentTypeMismatchException(value, Long.class, name, null, null);
    }
}
