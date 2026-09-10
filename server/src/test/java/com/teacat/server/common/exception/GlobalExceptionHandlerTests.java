package com.teacat.server.common.exception;

import com.teacat.server.common.response.BaseResponse;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 잘못 보낸 요청을 500 으로 내보내지 않는다.
 *
 * <p>프론트는 5xx 를 서버 장애로 보고 재시도한다. 클라이언트가 고쳐야 하는 요청에
 * 500 을 주면 고칠 수 없는 요청을 계속 두드리게 된다.
 */
class GlobalExceptionHandlerTests {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler(new SimpleMeterRegistry());

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

    private MethodArgumentTypeMismatchException mismatch(String name, Object value) {
        return new MethodArgumentTypeMismatchException(value, Long.class, name, null, null);
    }
}
