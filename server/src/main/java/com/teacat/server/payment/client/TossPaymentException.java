package com.teacat.server.payment.client;

import lombok.Getter;

/**
 * 토스가 요청을 거절했다.
 *
 * <p>토스의 {@code code} 를 그대로 들고 올라간다. 서비스가 이걸 payments.failure_code 에 남기고
 * 사용자에게는 도메인 에러 코드로 바꿔 응답한다 — 외부 서비스의 코드 체계를 프론트에 노출하면
 * 토스 쪽이 바뀔 때마다 프론트가 깨진다.
 */
@Getter
public class TossPaymentException extends RuntimeException {

    private final String code;

    public TossPaymentException(String code, String message) {
        super(message);
        this.code = code;
    }
}
