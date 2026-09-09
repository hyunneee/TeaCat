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
    private static final String CANCEL_PATH_FORMAT = "/v1/payments/%s/cancel";
    private static final String IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
    /** 토스가 "그런 주문번호가 없다" 고 답할 때의 코드 */
    private static final String NOT_FOUND_PAYMENT = "NOT_FOUND_PAYMENT";

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
     * 결제 취소 (전액 또는 부분).
     *
     * <p><b>같은 멱등 키로 다시 보내도 두 번 취소되지 않습니다.</b> 취소는 재시도가 필요한
     * 작업이라(환불이 안 되면 사용자 돈이 묶입니다) 키를 반드시 고정해서 보냅니다 —
     * 주문 번호에서 만들어 매번 같은 값이 되게 합니다.
     *
     * @param cancelAmount 부분취소 금액. null 이면 전액 취소
     * @throws TossPaymentException 토스가 거절한 경우 (이미 취소됨·기간 초과 등)
     */
    public TossPaymentResult cancel(String paymentKey, String reason, Integer cancelAmount,
            String idempotencyKey) {
        requireConfigured();

        Map<String, Object> body = cancelAmount == null
                ? Map.of("cancelReason", reason)
                : Map.of("cancelReason", reason, "cancelAmount", cancelAmount);

        try {
            TossPaymentResult result = restClient.post()
                    .uri(CANCEL_PATH_FORMAT.formatted(paymentKey))
                    .header(HttpHeaders.AUTHORIZATION, basicAuth())
                    .header(IDEMPOTENCY_KEY_HEADER, idempotencyKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(TossPaymentResult.class);

            if (result == null) {
                // 취소가 됐는지 모르는 상태다. 실패로 확정하면 재시도가 두 번 취소할 수 있다
                log.error("토스 취소 응답이 비어 있습니다. paymentKey 앞자리={}",
                        paymentKey.substring(0, Math.min(8, paymentKey.length())));
                throw new BusinessException(PaymentErrorCode.PAYMENT_CANCEL_FAILED);
            }

            return result;
        } catch (RestClientResponseException e) {
            throw toTossException(e, "cancel");
        }
    }

    /**
     * 주문번호로 결제를 조회합니다.
     *
     * <p>승인 결과를 못 받은 채 끊긴 결제를 되짚을 때 씁니다 — 우리가 모르는 사이에 승인이
     * 끝나 있을 수 있고, 그 경우 사용자는 돈만 낸 상태가 됩니다.
     *
     * <p>🔴 <b>"그런 주문이 없다" 와 "조회를 못 했다" 를 구분합니다.</b> 404 를 전부 전자로 보면,
     * 상점 설정처럼 다른 이유로 404 가 날 때 <b>이미 승인된 결제를 실패로 지웁니다.</b>
     * 실제로 위젯 키에서 {@code NOT_FOUND_MERCHANT} 가 돌아오는 것을 실결제 검증에서 잡았습니다.
     * 확실할 때만 {@link Lookup#notFound()} 이고, 나머지는 {@link Lookup#undetermined()} 입니다.
     */
    public Lookup findByOrderId(String orderId) {
        requireConfigured();

        try {
            TossPaymentResult found = restClient.get()
                    .uri(ORDER_PATH + orderId)
                    .header(HttpHeaders.AUTHORIZATION, basicAuth())
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(TossPaymentResult.class);

            return found == null ? Lookup.undetermined() : Lookup.of(found);
        } catch (RestClientResponseException e) {
            TossErrorBody error = readErrorBody(e);

            if (e.getStatusCode() == HttpStatus.NOT_FOUND && NOT_FOUND_PAYMENT.equals(error.code())) {
                // 토스가 "그런 주문번호는 없다" 고 답한 경우에만 없는 것으로 본다
                return Lookup.notFound();
            }

            log.warn("토스 결제 조회에 실패했습니다. 판단을 미룹니다. orderId={} status={} code={}",
                    orderId, e.getStatusCode(), error.code());
            return Lookup.undetermined();
        } catch (RuntimeException e) {
            log.warn("토스 결제 조회에 실패했습니다. 판단을 미룹니다. orderId={}", orderId, e);
            return Lookup.undetermined();
        }
    }

    /**
     * 조회 결과. <b>"없다" 와 "모르겠다" 는 다릅니다.</b>
     *
     * @param payment 찾았으면 그 결제, 아니면 null
     * @param absent  토스가 명시적으로 "없는 주문번호" 라고 답했는가
     */
    public record Lookup(TossPaymentResult payment, boolean absent) {

        public static Lookup of(TossPaymentResult payment) {
            return new Lookup(payment, false);
        }

        /** 토스가 그런 주문번호를 모른다 — 결제창까지 가지 않았다 */
        public static Lookup notFound() {
            return new Lookup(null, true);
        }

        /** 조회를 못 했다. 아무 결론도 내리면 안 된다 */
        public static Lookup undetermined() {
            return new Lookup(null, false);
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
