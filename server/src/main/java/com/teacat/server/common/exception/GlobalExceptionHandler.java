package com.teacat.server.common.exception;

import com.teacat.server.common.response.BaseResponse;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

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
