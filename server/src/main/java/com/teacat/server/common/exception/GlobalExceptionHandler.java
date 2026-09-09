package com.teacat.server.common.exception;

import com.teacat.server.common.response.BaseResponse;
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

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<BaseResponse<?>> handleCustomException(BusinessException e) {
        return ResponseEntity.status(e.getErrorCode().getHttpStatus())
                .body(BaseResponse.fail(e.getErrorCode()));
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

    @ExceptionHandler(Exception.class)
    public ResponseEntity<BaseResponse<?>> handleException(Exception e) {
        log.error("Unexpected error: ", e);
        return ResponseEntity.internalServerError()
                .body(BaseResponse.fail("서버 오류가 발생했습니다."));
    }

}
