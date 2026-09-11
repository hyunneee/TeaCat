package com.teacat.server.payment.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/**
 * 토스 결제 조회·승인 응답 중 우리가 쓰는 부분.
 *
 * 카드 정보 등 나머지는 받지 않는다 — 저장하지 않을 값을 굳이 메모리에 들일 이유가 없다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TossPaymentResult(
        String paymentKey,
        String orderId,
        /** READY / IN_PROGRESS / DONE / CANCELED / PARTIAL_CANCELED / ABORTED / EXPIRED */
        String status,
        Integer totalAmount,
        /** 카드 / 간편결제 / 계좌이체 … */
        String method,
        /** 승인 전이면 null. 시간대 오프셋이 붙어 온다 */
        OffsetDateTime approvedAt,
        Receipt receipt
) {

    private static final String DONE = "DONE";

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Receipt(String url) {
    }

    public boolean isDone() {
        return DONE.equals(status);
    }

    public String receiptUrl() {
        return receipt == null ? null : receipt.url();
    }

    /** DB 는 시간대 없는 timestamp 다. 서버 기준 시각으로 옮겨 저장한다 */
    public LocalDateTime approvedAtLocal() {
        return approvedAt == null ? LocalDateTime.now() : approvedAt.toLocalDateTime();
    }
}
