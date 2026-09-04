package com.teacat.server.payment.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.payment.exception.PaymentErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;

/**
 * 토스페이먼츠 결제 API.
 *
 * <p><b>제공자 스펙에 의존하는 곳은 여기 하나입니다.</b> 주소·인증·응답 모양이 바뀌면 이 파일만
 * 고칩니다. (auth 의 {@code SsafyOauthClient} 와 같은 규칙입니다)
 *
 * <p>인증은 시크릿 키를 아이디로 쓰는 HTTP Basic 입니다 — 비밀번호는 비우고 콜론만 붙입니다.
 */
@Slf4j
@Component
public class TossPaymentsClient {

    private static final String CONFIRM_PATH = "/v1/payments/confirm";
    private static final String ORDER_PATH = "/v1/payments/orders/";
    private static final String IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

    private final TossPaymentsProperties properties;
    private final RestClient restClient;

    public TossPaymentsClient(TossPaymentsProperties properties) {
        this.properties = properties;
        this.restClient = RestClient.builder()
                .baseUrl(properties.baseUrl() == null ? "" : properties.baseUrl())
                .requestFactory(requestFactory(properties))
                .build();
    }

    private static ClientHttpRequestFactory requestFactory(TossPaymentsProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) properties.connectTimeout().toMillis());
        factory.setReadTimeout((int) properties.readTimeout().toMillis());
        return factory;
    }

    /**
     * 결제 승인. 이 호출이 성공하면 <b>실제로 돈이 빠져나갑니다.</b>
     *
     * @param idempotencyKey 같은 키로 다시 보내도 두 번 승인되지 않는다. 우리 주문번호를 그대로 쓴다
     * @throws TossPaymentException 토스가 거절한 경우 (한도 초과·카드사 거절 등)
     */
    public TossPaymentResult confirm(String paymentKey, String orderId, int amount, String idempotencyKey) {
        requireConfigured();

        Map<String, Object> body = Map.of(
                "paymentKey", paymentKey,
                "orderId", orderId,
                "amount", amount);

        try {
            TossPaymentResult result = restClient.post()
                    .uri(CONFIRM_PATH)
                    .header(HttpHeaders.AUTHORIZATION, basicAuth())
                    .header(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(TossPaymentResult.class);

            if (result == null) {
                // 승인이 됐는지 안 됐는지 모르는 상태다. 실패로 확정하면 안 되고 복구 배치가 봐야 한다
                log.error("토스 승인 응답이 비어 있습니다. orderId={}", orderId);
                throw new BusinessException(PaymentErrorCode.PAYMENT_APPROVAL_FAILED);
            }

            return result;
        } catch (RestClientResponseException e) {
            throw toTossException(e, orderId);
        }
    }

    /**
     * 주문번호로 결제를 조회합니다.
     *
     * <p>승인 결과를 못 받은 채 끊긴 결제를 되짚을 때 씁니다 — 우리가 모르는 사이에 승인이
     * 끝나 있을 수 있고, 그 경우 사용자는 돈만 낸 상태가 됩니다.
     *
     * @return 토스가 모르는 주문번호면 비어 있다 (결제창까지 가지 않았다는 뜻)
     */
    public Optional<TossPaymentResult> findByOrderId(String orderId) {
        requireConfigured();

        try {
            return Optional.ofNullable(restClient.get()
                    .uri(ORDER_PATH + orderId)
                    .header(HttpHeaders.AUTHORIZATION, basicAuth())
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(TossPaymentResult.class));
        } catch (RestClientResponseException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                return Optional.empty();
            }
            throw toTossException(e, orderId);
        }
    }

    /**
     * 토스 에러 응답은 {@code { code, message }} 다. 코드를 살려 올려야 실패 사유를 남길 수 있다.
     *
     * <p>본문을 로그에 남기지 않는다 — 결제 응답에는 마스킹됐더라도 카드 정보가 섞여 있다.
     */
    private TossPaymentException toTossException(RestClientResponseException e, String orderId) {
        TossErrorBody error = readErrorBody(e);
        log.error("토스 결제 API 호출 실패 orderId={} status={} code={}",
                orderId, e.getStatusCode(), error.code());

        return new TossPaymentException(error.code(), error.message());
    }

    private TossErrorBody readErrorBody(RestClientResponseException e) {
        try {
            TossErrorBody body = e.getResponseBodyAs(TossErrorBody.class);
            if (body != null && body.code() != null) {
                return body;
            }
        } catch (RuntimeException ignored) {
            // 토스 규격이 아닌 응답(게이트웨이 오류 등). 아래 기본값으로 떨어진다
        }

        return new TossErrorBody("UNKNOWN", "결제 처리 중 오류가 발생했습니다.");
    }

    private String basicAuth() {
        String credentials = properties.secretKey() + ":";
        return "Basic " + Base64.getEncoder()
                .encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    }

    private void requireConfigured() {
        if (!properties.isConfigured()) {
            log.error("토스 결제 설정이 비어 있습니다 (payment.toss.base-url / payment.toss.secret-key)");
            throw new BusinessException(PaymentErrorCode.PAYMENT_NOT_CONFIGURED);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record TossErrorBody(String code, String message) {
    }
}
