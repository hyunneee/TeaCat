package com.teacat.server.common.exception;

import com.teacat.server.common.response.BaseResponse;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Set;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /**
     * 비즈니스 예외를 코드별로 센다.
     *
     * <p>여기 한 곳에 두는 이유는 <b>모든 도메인이 이 핸들러를 지나가기 때문</b>이다.
     * 서비스마다 계측을 흩어놓지 않아도 ERR_BOOKING_* 과 NFT_* 이 한 번에 잡힌다.
     *
     * <p>🔴 이 지표를 "에러율"로 읽으면 안 된다. 티켓 오픈에서 ERR_BOOKING_004(좌석 선점 실패)는
     *    정상 동작이다 — 한 좌석을 여러 명이 누르면 한 명 빼고 전부 이 코드를 받는다.
     *    의미가 있는 건 <b>비율의 급변</b>이다. 평소 5% 인 것이 90% 가 되면 락이 안 풀리는 것이고,
     *    NFT_032/038(체인 실패)처럼 원래 0 이어야 하는 코드는 1건도 신호다.
     *    (docker/monitoring/prometheus/rules/alerts.yml 참고)
     *
     * <p>🔴 {@code Counter.Builder} 를 필드로 공유하지 않는다. {@code tag()} 가 빌더 내부 상태를
     *    <b>변경</b>하며 자기 자신을 돌려주기 때문에, 공유하면 요청마다 태그가 누적되고 동시 요청
     *    사이에 경합이 생겨 A 코드의 예외가 B 코드로 집계된다. 티켓 오픈처럼 예외가 몰릴 때
     *    정확히 틀어지는 종류의 버그다. 빌더는 매번 새로 만들고, {@code register()} 가
     *    이름+태그로 기존 미터를 찾아 돌려주므로 비용은 조회 한 번이다.
     */
    private static final String BUSINESS_ERROR_METRIC = "teacat.business.error";

    private final MeterRegistry meterRegistry;

    public GlobalExceptionHandler(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<BaseResponse<?>> handleCustomException(BusinessException e) {
        ErrorCode errorCode = e.getErrorCode();

        Counter.builder(BUSINESS_ERROR_METRIC)
                .description("비즈니스 예외 발생 수 (ErrorCode 별)")
                .tag("code", errorCode.getCode())
                .tag("status", String.valueOf(errorCode.getHttpStatus().value()))
                .register(meterRegistry)
                .increment();

        return ResponseEntity.status(errorCode.getHttpStatus())
                .body(BaseResponse.fail(errorCode));
    }

    // @Valid 검증 실패
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<BaseResponse<Void>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(FieldError::getDefaultMessage)
                .orElse("잘못된 요청입니다.");

        return ResponseEntity.badRequest()
                .body(BaseResponse.fail(message));
    }

    /**
     * 본문을 읽지 못했다 — 깨진 JSON, 잘못된 인코딩, 타입이 안 맞는 값.
     *
     * <p>이건 <b>클라이언트가 잘못 보낸 것</b>이라 400 이다. 포괄 핸들러에 맡기면 500 이 나가고,
     * 프론트는 서버 장애로 보고 재시도한다.
     *
     * <p>예외 메시지를 그대로 내보내지 않는다 — 파싱 오류에는 필드명·클래스명 같은 내부 구조가
     * 섞여 나온다. 자세한 내용은 로그에만 남긴다.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<BaseResponse<Void>> handleUnreadableBody(HttpMessageNotReadableException e) {
        log.warn("요청 본문을 읽지 못했습니다: {}", e.getMessage());

        return ResponseEntity.badRequest()
                .body(BaseResponse.fail("요청 본문을 읽을 수 없습니다."));
    }

    /**
     * 경로·쿼리 파라미터를 선언한 타입으로 바꾸지 못했다 — {@code /concerts/new},
     * {@code /concerts?size=abc} 처럼.
     *
     * <p>{@link HttpMessageNotReadableException} 과 같은 이유로 400 이다. 본문이 아니라
     * 주소에서 왔을 뿐 <b>클라이언트가 잘못 보낸 것</b>이고, 포괄 핸들러에 맡기면 500 이 나가
     * 프론트가 서버 장애로 보고 재시도한다. 지워진 화면의 옛 링크(`/concerts/new`)가 남아
     * 있을 때 실제로 이 경로로 500 이 나갔다.
     *
     * <p>파라미터 이름까지만 알려준다. 값과 대상 타입(클래스명)은 붙이지 않는다 —
     * 값에는 사용자 입력이, 타입에는 내부 구조가 섞인다. 자세한 내용은 로그에만 남긴다.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<BaseResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        log.warn("요청 파라미터 형식이 올바르지 않습니다: name={}", e.getName());

        return ResponseEntity.badRequest()
                .body(BaseResponse.fail("%s 값의 형식이 올바르지 않습니다.".formatted(e.getName())));
    }

    /**
     * 그런 경로가 없다 — 404.
     *
     * <p>🔴 이걸 포괄 핸들러에 맡기면 <b>500 이 나가고 Sentry 이슈가 열린다.</b> 인터넷에 열린
     *    서버는 {@code /.env}, {@code /wp-login.php} 같은 스캔을 하루에도 수백 번 받는다.
     *    그 전부가 "예상 못 한 예외" 로 집계되면 {@code teacat.unexpected.error} 카운터가
     *    쓸모없어진다 — 1건도 알림 대상인 지표인데 봇 소리에 묻힌다.
     *    프론트에 남은 옛 링크·오타 하나도 같은 이유로 장애 알림이 됐다.
     *
     * <p>두 예외를 같이 잡는다. 스프링은 남는 경로를 정적 리소스 핸들러에 맡기므로 보통
     * {@link NoResourceFoundException} 이 오지만, 설정에 따라 {@link NoHandlerFoundException}
     * 이 오는 경로도 있다. 둘은 공통 조상이 없어서 한 클래스로는 못 잡는다.
     *
     * <p>로그는 {@code warn} 이다 — {@code error} 는 그대로 Sentry 로 나간다(CLAUDE.md 9장).
     * 경로만 남기고 쿼리스트링은 붙이지 않는다. 스캔 주소에는 토큰·이메일이 실려 오기도 한다.
     */
    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<BaseResponse<Void>> handleNotFound(Exception e) {
        log.warn("존재하지 않는 경로 요청: {}", requestPathOf(e));

        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(BaseResponse.fail("요청한 경로를 찾을 수 없습니다."));
    }

    /**
     * 경로는 맞지만 메서드가 다르다 — 405. (예: {@code POST /auth/login} 을 GET 으로 부름)
     *
     * <p>404 와 같은 이유로 여기서 잡는다. 포괄 핸들러에 맡기면 500 이 나가고, 이건
     * <b>클라이언트가 고쳐야 하는 요청</b>이라 재시도로는 절대 풀리지 않는다.
     *
     * <p>{@code Allow} 헤더를 붙인다 — 스펙이 405 에 요구하는 헤더이고, 무엇으로 다시
     * 불러야 하는지 알 수 있는 유일한 단서다.
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<BaseResponse<Void>> handleMethodNotAllowed(HttpRequestMethodNotSupportedException e) {
        log.warn("허용되지 않은 메서드: {}", e.getMethod());

        ResponseEntity.BodyBuilder response = ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED);
        Set<HttpMethod> allowed = e.getSupportedHttpMethods();
        if (allowed != null && !allowed.isEmpty()) {
            response.allow(allowed.toArray(HttpMethod[]::new));
        }

        return response.body(BaseResponse.fail("허용되지 않은 요청 방식입니다."));
    }

    /** 두 404 예외는 공통 조상이 없어서 경로를 꺼내는 방법도 갈린다 */
    private static String requestPathOf(Exception e) {
        if (e instanceof NoResourceFoundException resource) return resource.getResourcePath();
        if (e instanceof NoHandlerFoundException handler) return handler.getRequestURL();
        return "(알 수 없음)";
    }

    /**
     * 예상 못 한 예외. 이건 <b>전부 진짜 장애</b>라 위와 달리 1건도 알림 대상이다.
     *
     * <p>태그로 예외 클래스명만 쓴다. 메시지를 태그에 넣으면 사용자 입력이 섞여 들어와
     * 시계열이 무한히 늘어난다 (카디널리티 폭발).
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<BaseResponse<?>> handleException(Exception e) {
        log.error("Unexpected error: ", e);

        meterRegistry.counter("teacat.unexpected.error",
                "exception", e.getClass().getSimpleName()).increment();

        return ResponseEntity.internalServerError()
                .body(BaseResponse.fail("서버 오류가 발생했습니다."));
    }

}
