package com.teacat.server.payment.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.payment.client.TossPaymentException;
import com.teacat.server.payment.client.TossPaymentResult;
import com.teacat.server.payment.client.TossPaymentsClient;
import com.teacat.server.payment.dto.request.TokenChargeConfirmRequest;
import com.teacat.server.payment.dto.response.TokenChargePrepareResponse;
import com.teacat.server.payment.dto.response.TokenChargeResponse;
import com.teacat.server.payment.dto.response.TokenChargeStatus;
import com.teacat.server.payment.exception.PaymentErrorCode;
import com.teacat.server.wallet.client.CatMoneyClient;
import com.teacat.server.wallet.client.CatMoneyWriteResult;
import com.teacat.server.wallet.client.TxReportResult;
import com.teacat.server.wallet.entity.CatTxReason;
import com.teacat.server.wallet.service.CatMoneyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.math.BigInteger;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willReturn;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * 캣머니 충전 흐름.
 *
 * <p>토스와 블록체인 서비스는 대역으로 세웁니다 — 실제 결제를 일으킬 수 없고, 여기서 확인하려는
 * 것은 <b>우리 쪽 상태 전이</b>이기 때문입니다. 특히 "돈은 나갔는데 기록이 없다" 와
 * "결제 한 번에 두 번 발행된다" 를 막는 부분을 봅니다.
 */
@Testcontainers
@SpringBootTest(properties = {
        "payment.toss.secret-key=test_sk_dummy",
        // 테스트가 스케줄러와 경합하지 않도록 자동 실행 주기를 길게 둔다 (필요한 건 직접 부른다)
        "payment.recovery.interval=1h",
        "payment.recovery.initial-delay=1h",
        "blockchain.confirm-poll.interval=1h",
        "blockchain.confirm-poll.initial-delay=1h"
})
class TokenChargeIntegrationTests {

    private static final int CHARGE_AMOUNT = 10_000;
    private static final String TX_HASH =
            "0x1111111111111111111111111111111111111111111111111111111111111111";

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("pgvector/pgvector:pg18")
            .withDatabaseName("teacat_payment_test")
            .withUsername("teacat")
            .withPassword("teacat_test_pw")
            .withStartupTimeout(Duration.ofMinutes(2));

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @MockitoBean
    private TossPaymentsClient tossPaymentsClient;

    @MockitoBean
    private CatMoneyClient catMoneyClient;

    @Autowired
    private TokenChargeService tokenChargeService;

    @Autowired
    private TokenChargeScheduler tokenChargeScheduler;

    @Autowired
    private CatMoneyService catMoneyService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Long userId;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("TRUNCATE TABLE users, faces, wallet_owners, wallets RESTART IDENTITY CASCADE");
        userId = insertUserWithWallet();
    }

    @Test
    void 충전을_승인하면_결제가_확정되고_캣머니_발행이_나간다() {
        TokenChargePrepareResponse prepared = tokenChargeService.prepare(userId, CHARGE_AMOUNT);
        givenTossApproves(prepared.orderId());
        givenMintAccepted();

        TokenChargeResponse charged = tokenChargeService.confirm(userId, confirmRequest(prepared));

        // 결제는 끝났지만 체인 확정은 아직이다. 이 구간을 실패로 보이게 하면 안 된다
        assertThat(charged.status()).isEqualTo(TokenChargeStatus.MINTING);
        assertThat(charged.tokenAmount()).isEqualTo(CHARGE_AMOUNT);
        assertThat(paymentStatus(prepared.orderId())).isEqualTo("DONE");
        assertThat(countCatTransactions("MINT", "DEPOSIT")).isEqualTo(1L);

        // 발행 키는 우리 PK 기반이라 예측 가능해도 안전하고, 재시도 때 같은 값이어야 한다
        ArgumentCaptor<String> operationKey = ArgumentCaptor.forClass(String.class);
        verify(catMoneyClient).mint(operationKey.capture(), anyString(),
                eq(BigInteger.valueOf(CHARGE_AMOUNT)), eq(CatTxReason.DEPOSIT));
        assertThat(operationKey.getValue()).isEqualTo("charge:" + charged.chargeId());
    }

    @Test
    void 체인이_확정되면_충전이_완료로_바뀐다() {
        TokenChargeResponse charged = charge();
        given(catMoneyClient.findTxReport(TX_HASH))
                .willReturn(Optional.of(new TxReportResult("CONFIRMED", TX_HASH, 12L, null)));

        settlePendingTransactions();

        assertThat(tokenChargeService.getCharge(userId, charged.chargeId()).status())
                .isEqualTo(TokenChargeStatus.COMPLETED);
    }

    @Test
    void 같은_승인을_다시_보내도_한_번만_발행된다() {
        TokenChargePrepareResponse prepared = tokenChargeService.prepare(userId, CHARGE_AMOUNT);
        givenTossApproves(prepared.orderId());
        givenMintAccepted();

        TokenChargeResponse first = tokenChargeService.confirm(userId, confirmRequest(prepared));
        // 결제 완료 화면을 새로고침하면 실제로 이렇게 다시 들어온다
        TokenChargeResponse second = tokenChargeService.confirm(userId, confirmRequest(prepared));

        assertThat(second.chargeId()).isEqualTo(first.chargeId());
        assertThat(countTokenCharges()).isEqualTo(1L);
        assertThat(countCatTransactions("MINT", "DEPOSIT")).isEqualTo(1L);
        verify(tossPaymentsClient).confirm(anyString(), anyString(), anyInt(), anyString());
    }

    @Test
    void 프론트가_보낸_금액이_다르면_승인을_보내지_않는다() {
        TokenChargePrepareResponse prepared = tokenChargeService.prepare(userId, CHARGE_AMOUNT);

        assertThatThrownBy(() -> tokenChargeService.confirm(userId,
                new TokenChargeConfirmRequest("payment-key", prepared.orderId(), 100)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PaymentErrorCode.PAYMENT_AMOUNT_MISMATCH);

        // 위조된 금액으로 토스를 부르면 그 금액이 그대로 승인된다. 부르기 전에 막아야 한다
        verify(tossPaymentsClient, never()).confirm(anyString(), anyString(), anyInt(), anyString());
        assertThat(paymentStatus(prepared.orderId())).isEqualTo("READY");
    }

    @Test
    void 남의_결제는_승인할_수_없다() {
        TokenChargePrepareResponse prepared = tokenChargeService.prepare(userId, CHARGE_AMOUNT);
        Long otherUserId = insertUser("other@test.com");

        assertThatThrownBy(() -> tokenChargeService.confirm(otherUserId, confirmRequest(prepared)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PaymentErrorCode.PAYMENT_OWNER_MISMATCH);

        verify(tossPaymentsClient, never()).confirm(anyString(), anyString(), anyInt(), anyString());
    }

    @Test
    void 토스가_거절하면_실패_사유가_남는다() {
        TokenChargePrepareResponse prepared = tokenChargeService.prepare(userId, CHARGE_AMOUNT);
        willThrow(new TossPaymentException("REJECT_CARD_COMPANY", "카드사에서 거절했습니다."))
                .given(tossPaymentsClient).confirm(anyString(), anyString(), anyInt(), anyString());

        assertThatThrownBy(() -> tokenChargeService.confirm(userId, confirmRequest(prepared)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PaymentErrorCode.PAYMENT_APPROVAL_FAILED);

        assertThat(paymentStatus(prepared.orderId())).isEqualTo("ABORTED");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT failure_code FROM payments WHERE order_id = ?", String.class, prepared.orderId()))
                .isEqualTo("REJECT_CARD_COMPANY");
        assertThat(countCatTransactions("MINT", "DEPOSIT")).isZero();
    }

    @Test
    void 발행이_나가지_못해도_결제는_성공이고_재시도_대상으로_남는다() {
        TokenChargePrepareResponse prepared = tokenChargeService.prepare(userId, CHARGE_AMOUNT);
        givenTossApproves(prepared.orderId());
        willThrow(new IllegalStateException("체인에 연결할 수 없습니다"))
                .given(catMoneyClient).mint(anyString(), anyString(), any(), any());

        // 사용자는 이미 돈을 냈다. 여기서 실패를 던지면 사용자가 다시 결제한다
        TokenChargeResponse charged = tokenChargeService.confirm(userId, confirmRequest(prepared));

        assertThat(charged.status()).isEqualTo(TokenChargeStatus.MINTING);
        assertThat(paymentStatus(prepared.orderId())).isEqualTo("DONE");
        assertThat(mintTxIdOf(charged.chargeId())).isNull();

        // 체인이 돌아오면 재시도 배치가 발행을 이어서 보낸다
        givenMintAccepted();
        tokenChargeScheduler.retryMissingMints();

        assertThat(mintTxIdOf(charged.chargeId())).isNotNull();
        assertThat(countCatTransactions("MINT", "DEPOSIT")).isEqualTo(1L);
    }

    @Test
    void 응답을_못_받은_결제는_토스에_되물어_되살린다() {
        TokenChargePrepareResponse prepared = tokenChargeService.prepare(userId, CHARGE_AMOUNT);
        // 승인은 나갔는데 응답을 받기 전에 끊긴 상태를 만든다
        jdbcTemplate.update("UPDATE payments SET status = 'IN_PROGRESS', created_at = now() - interval '1 hour'"
                + " WHERE order_id = ?", prepared.orderId());
        given(tossPaymentsClient.findByOrderId(prepared.orderId()))
                .willReturn(Optional.of(approvedResult(prepared.orderId())));
        givenMintAccepted();

        tokenChargeScheduler.recoverUnsettledPayments();

        assertThat(paymentStatus(prepared.orderId())).isEqualTo("DONE");
        assertThat(countTokenCharges()).isEqualTo(1L);
        assertThat(countCatTransactions("MINT", "DEPOSIT")).isEqualTo(1L);
    }

    @Test
    void 결제창까지_가지_않은_주문은_실패로_정리된다() {
        TokenChargePrepareResponse prepared = tokenChargeService.prepare(userId, CHARGE_AMOUNT);
        jdbcTemplate.update("UPDATE payments SET created_at = now() - interval '1 hour' WHERE order_id = ?",
                prepared.orderId());
        given(tossPaymentsClient.findByOrderId(prepared.orderId())).willReturn(Optional.empty());

        tokenChargeScheduler.recoverUnsettledPayments();

        assertThat(paymentStatus(prepared.orderId())).isEqualTo("ABORTED");
        assertThat(countTokenCharges()).isZero();
    }

    @Test
    void 충전_한도를_벗어나면_주문이_만들어지지_않는다() {
        assertThatThrownBy(() -> tokenChargeService.prepare(userId, 100))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PaymentErrorCode.PAYMENT_AMOUNT_OUT_OF_RANGE);

        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM payments", Long.class)).isZero();
    }

    @Test
    void 고객키는_회원마다_한_번만_만들어진다() {
        TokenChargePrepareResponse first = tokenChargeService.prepare(userId, CHARGE_AMOUNT);
        TokenChargePrepareResponse second = tokenChargeService.prepare(userId, CHARGE_AMOUNT);

        assertThat(second.customerKey()).isEqualTo(first.customerKey());
        // 주문번호는 매번 새로 만들어져야 한다
        assertThat(second.orderId()).isNotEqualTo(first.orderId());
    }

    // ── 대역 ────────────────────────────────────────────────

    private void givenTossApproves(String orderId) {
        given(tossPaymentsClient.confirm(anyString(), eq(orderId), anyInt(), anyString()))
                .willReturn(approvedResult(orderId));
    }

    /**
     * {@code given(mock.method())} 가 아니라 이 형태를 쓴다 — 앞에서 예외를 던지도록 스텁한 뒤
     * 다시 스터빙할 때, 전자는 스텁된 메서드를 실제로 <b>호출해서</b> 그 예외가 터진다.
     */
    private void givenMintAccepted() {
        willReturn(new CatMoneyWriteResult("PENDING", TX_HASH))
                .given(catMoneyClient).mint(anyString(), anyString(), any(), any());
    }

    private TossPaymentResult approvedResult(String orderId) {
        return new TossPaymentResult("payment-key-" + orderId, orderId, "DONE", CHARGE_AMOUNT,
                "카드", OffsetDateTime.now(), new TossPaymentResult.Receipt("https://receipt.example/1"));
    }

    private TokenChargeConfirmRequest confirmRequest(TokenChargePrepareResponse prepared) {
        return new TokenChargeConfirmRequest("payment-key", prepared.orderId(), prepared.amount());
    }

    private TokenChargeResponse charge() {
        TokenChargePrepareResponse prepared = tokenChargeService.prepare(userId, CHARGE_AMOUNT);
        givenTossApproves(prepared.orderId());
        givenMintAccepted();
        return tokenChargeService.confirm(userId, confirmRequest(prepared));
    }

    /** 확정 폴링이 하는 일을 그대로 부른다 (스케줄 주기에 의존하지 않기 위해) */
    private void settlePendingTransactions() {
        jdbcTemplate.queryForList("SELECT id FROM cat_transactions WHERE status = 'PENDING'", Long.class)
                .forEach(catMoneyService::settle);
    }

    // ── 픽스처 ──────────────────────────────────────────────

    private Long insertUserWithWallet() {
        Long id = insertUser("charger@test.com");
        Long ownerId = jdbcTemplate.queryForObject("""
                INSERT INTO wallet_owners (user_id, derivation_index, owner_address, key_version, status)
                VALUES (?, 0, '0x1111111111111111111111111111111111111111', 1, 'ACTIVE')
                RETURNING id
                """, Long.class, id);
        jdbcTemplate.update("""
                INSERT INTO wallets (owner_id, chain_id, type, address, status, deployed)
                VALUES (?, 31221, 'RELAYER_EOA', '0x1111111111111111111111111111111111111111', 'ACTIVE', false)
                """, ownerId);
        return id;
    }

    private Long insertUser(String email) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO users (email, password, name, nickname, phone, role)
                VALUES (?, 'encoded-password', '테스트 사용자', ?, '010-0000-0000', 'USER'::user_role)
                RETURNING id
                """, Long.class, email, email);
    }

    // ── 검증 헬퍼 ────────────────────────────────────────────

    private String paymentStatus(String orderId) {
        return jdbcTemplate.queryForObject(
                "SELECT status::text FROM payments WHERE order_id = ?", String.class, orderId);
    }

    private Long countTokenCharges() {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM token_charges", Long.class);
    }

    private Long countCatTransactions(String direction, String reason) {
        return jdbcTemplate.queryForObject(
                "SELECT count(*) FROM cat_transactions WHERE direction::text = ? AND reason::text = ?",
                Long.class, direction, reason);
    }

    private Long mintTxIdOf(Long chargeId) {
        return jdbcTemplate.queryForObject(
                "SELECT mint_tx_id FROM token_charges WHERE id = ?", Long.class, chargeId);
    }
}
