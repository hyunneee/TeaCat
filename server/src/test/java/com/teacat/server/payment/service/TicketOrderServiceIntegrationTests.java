package com.teacat.server.payment.service;

import com.teacat.server.booking.exception.BookingErrorCode;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.payment.dto.response.TicketOrderPrepareResponse;
import com.teacat.server.payment.exception.PaymentErrorCode;
import com.teacat.server.payment.client.TossPaymentException;
import com.teacat.server.ticket.client.BlockchainTicketClient;
import com.teacat.server.ticket.client.TicketIssueResult;
import com.teacat.server.payment.client.TossPaymentResult;
import com.teacat.server.payment.client.TossPaymentsClient;
import com.teacat.server.payment.dto.request.TicketOrderConfirmRequest;
import com.teacat.server.payment.dto.response.TicketOrderResponse;
import com.teacat.server.wallet.client.CatMoneyBalanceResult;
import com.teacat.server.wallet.client.CatMoneyWriteResult;
import com.teacat.server.wallet.client.CatMoneyClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.Duration;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.willReturn;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * 티켓 주문 생성 — <b>금액 분해</b>가 이 클래스의 주제입니다.
 *
 * <p>캣머니 사용분을 프론트가 정하지 못하게 하는 것이 요점이라, 체인 잔액만 대역으로 두고
 * 나머지(홀드 원장·좌석 선점·가격)는 실제 DB 로 돌립니다.
 */
@Testcontainers
@SpringBootTest(properties = {
        "payment.toss.secret-key=test_sk_dummy",
        "payment.recovery.interval=1h",
        "payment.recovery.initial-delay=1h",
        "blockchain.confirm-poll.interval=1h",
        "blockchain.confirm-poll.initial-delay=1h",
        "nft.auction.sweep-enabled=false"
})
class TicketOrderServiceIntegrationTests {

    private static final int PRICE = 88_000;

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("pgvector/pgvector:pg18")
            .withDatabaseName("teacat_ticket_order_test")
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
    private CatMoneyClient catMoneyClient;

    @MockitoBean
    private TossPaymentsClient tossPaymentsClient;

    @MockitoBean
    private BlockchainTicketClient blockchainTicketClient;

    @Autowired
    private TicketOrderService ticketOrderService;

    @Autowired
    private com.teacat.server.ticket.service.TicketIssueService ticketIssueService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Long userId;
    private Long detailId;
    private Long seatId;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("""
                TRUNCATE TABLE users, faces, stadiums, performance_general, wallet_owners, wallets,
                               cat_money_holds, cat_transactions, payments, ticket_orders, tickets, nft_tickets
                RESTART IDENTITY CASCADE""");
        userId = insertUserWithFaceAndWallet();
        Fixture fixture = insertPerformanceFixture();
        detailId = fixture.detailId();
        seatId = fixture.seatId();
        holdSeat(userId, detailId, seatId);
    }

    @Test
    void 캣머니가_티켓값보다_적으면_모자란_만큼만_카드로_받는다() {
        givenChainBalance(11_401);

        TicketOrderPrepareResponse order = ticketOrderService.open(userId, detailId, seatId);

        assertThat(order.totalAmount()).isEqualTo(PRICE);
        assertThat(order.tokenAmount()).isEqualTo(11_401);
        assertThat(order.cashAmount()).isEqualTo(PRICE - 11_401);
        // 카드로 낼 금액이 있으니 결제창을 띄울 수 있어야 한다
        assertThat(order.orderId()).isNotNull();
        assertThat(order.customerKey()).isNotNull();
    }

    @Test
    void 캣머니가_티켓값을_넘으면_티켓값까지만_쓰고_카드는_안_받는다() {
        givenChainBalance(500_000);

        TicketOrderPrepareResponse order = ticketOrderService.open(userId, detailId, seatId);

        assertThat(order.tokenAmount()).isEqualTo(PRICE);
        assertThat(order.cashAmount()).isZero();
        // 토스는 0원 결제를 못 받는다. 결제창을 띄우면 안 되므로 주문번호를 주지 않는다
        assertThat(order.orderId()).isNull();
        assertThat(order.customerKey()).isNull();
        assertThat(countPayments()).isZero();
    }

    @Test
    void 캣머니가_없으면_전액_카드다() {
        givenChainBalance(0);

        TicketOrderPrepareResponse order = ticketOrderService.open(userId, detailId, seatId);

        assertThat(order.tokenAmount()).isZero();
        assertThat(order.cashAmount()).isEqualTo(PRICE);
        assertThat(countHolds()).isZero();
    }

    @Test
    void 쓰기로_한_캣머니는_즉시_홀드로_묶인다() {
        givenChainBalance(11_401);

        TicketOrderPrepareResponse order = ticketOrderService.open(userId, detailId, seatId);

        // 결제창을 띄워둔 채로 같은 돈을 경매에 또 쓰지 못해야 한다
        assertThat(jdbcTemplate.queryForObject("""
                SELECT amount FROM cat_money_holds
                 WHERE ref_type = 'TICKET_ORDER' AND ref_id = ? AND status = 'ACTIVE'
                """, Long.class, order.ticketOrderId())).isEqualTo(11_401L);
    }

    @Test
    void 이미_묶인_캣머니는_다음_주문에_쓸_수_없다() {
        givenChainBalance(11_401);
        ticketOrderService.open(userId, detailId, seatId);

        // 같은 회차에는 좌석을 하나만 잡을 수 있으므로(uq_performance_seats_held_by)
        // 다른 회차의 좌석으로 주문한다. 앞 주문이 묶어둔 몫은 빠져 있어야 한다
        Long otherDetailId = insertPerformanceDetail(2);
        Long otherSeatId = insertSeat("3", 13);
        insertPerformanceSeat(otherDetailId, otherSeatId);
        holdSeat(userId, otherDetailId, otherSeatId);

        TicketOrderPrepareResponse second = ticketOrderService.open(userId, otherDetailId, otherSeatId);

        assertThat(second.tokenAmount()).isZero();
        assertThat(second.cashAmount()).isEqualTo(PRICE);
    }

    @Test
    void 선점하지_않은_좌석으로는_주문할_수_없다() {
        givenChainBalance(0);
        jdbcTemplate.update("UPDATE performance_seats SET status = 'AVAILABLE', held_by = NULL,"
                + " held_until = NULL WHERE performance_detail_id = ? AND seat_id = ?", detailId, seatId);

        assertThatThrownBy(() -> ticketOrderService.open(userId, detailId, seatId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(BookingErrorCode.SEAT_HOLD_NOT_FOUND);
    }

    @Test
    void 선점이_만료됐으면_주문할_수_없다() {
        givenChainBalance(0);
        jdbcTemplate.update("UPDATE performance_seats SET held_until = now() - interval '1 minute'"
                + " WHERE performance_detail_id = ? AND seat_id = ?", detailId, seatId);

        assertThatThrownBy(() -> ticketOrderService.open(userId, detailId, seatId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(BookingErrorCode.SEAT_HOLD_EXPIRED);
    }

    @Test
    void 결제_시점에_얼굴이_없으면_거절한다() {
        givenChainBalance(0);
        // 선점 뒤에 얼굴을 지운 상황 (API-110). 얼굴 없이는 티켓 행을 만들 수 없다
        jdbcTemplate.update("UPDATE users SET face_id = NULL WHERE id = ?", userId);

        assertThatThrownBy(() -> ticketOrderService.open(userId, detailId, seatId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(BookingErrorCode.FACE_NOT_REGISTERED);

        assertThat(countPayments()).isZero();
    }

    @Test
    void 구역에_가격이_없으면_주문할_수_없다() {
        givenChainBalance(0);
        jdbcTemplate.update("UPDATE performance_areas SET price = NULL");

        assertThatThrownBy(() -> ticketOrderService.open(userId, detailId, seatId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PaymentErrorCode.AREA_PRICE_NOT_SET);
    }

    @Test
    void 카드_승인이_끝나면_발권되고_좌석이_팔린다() {
        givenChainBalance(11_401);
        var order = ticketOrderService.open(userId, detailId, seatId);
        givenTossApproves(order.orderId(), order.cashAmount());
        givenBurnAccepted();

        TicketOrderResponse paid = ticketOrderService.confirm(userId, confirmRequest(order));

        assertThat(paid.ticketId()).isNotNull();
        assertThat(paid.ticketKey()).isNotNull();
        assertThat(paid.paidAt()).isNotNull();
        // 발행은 아직 확정 전인 것이 정상이다
        assertThat(paid.nftStatus()).isEqualTo("PENDING");
        assertThat(seatStatus()).isEqualTo("SOLD");
        assertThat(orderStatus(order.ticketOrderId())).isEqualTo("PAID");
        assertThat(holdStatus(order.ticketOrderId())).isEqualTo("CAPTURED");
        assertThat(countCatTransactions("BURN", "PAYMENT")).isEqualTo(1L);
    }

    @Test
    void 발권되면_NFT_발행_요청이_티켓키로_나간다() {
        givenChainBalance(11_401);
        var order = ticketOrderService.open(userId, detailId, seatId);
        givenTossApproves(order.orderId(), order.cashAmount());
        givenBurnAccepted();
        givenIssueAccepted();

        TicketOrderResponse paid = ticketOrderService.confirm(userId, confirmRequest(order));

        // 발행 키는 티켓의 UUID 다. 순번이면 남의 키를 추측해 미리 태울 수 있다
        verify(blockchainTicketClient).issue(eq(paid.ticketKey()), anyString());
    }

    @Test
    void 발행_요청이_실패해도_예매는_유효하고_재시도_대상으로_남는다() {
        givenChainBalance(11_401);
        var order = ticketOrderService.open(userId, detailId, seatId);
        givenTossApproves(order.orderId(), order.cashAmount());
        givenBurnAccepted();
        willThrow(new IllegalStateException("체인 연결 실패"))
                .given(blockchainTicketClient).issue(any(), anyString());

        TicketOrderResponse paid = ticketOrderService.confirm(userId, confirmRequest(order));

        assertThat(paid.ticketId()).isNotNull();
        assertThat(orderStatus(order.ticketOrderId())).isEqualTo("PAID");
        // mint_tx_hash 는 블록체인 서비스가 채운다. 비어 있으면 재시도 대상이다
        assertThat(ticketIssueService.findUnissued(
                java.time.LocalDateTime.now().plusMinutes(1), org.springframework.data.domain.Limit.of(10)))
                .contains(paid.ticketId());
    }

    @Test
    void 전액_캣머니면_토스를_부르지_않는다() {
        givenChainBalance(500_000);
        var order = ticketOrderService.open(userId, detailId, seatId);
        givenBurnAccepted();

        TicketOrderResponse paid = ticketOrderService.confirm(
                userId, new TicketOrderConfirmRequest(order.ticketOrderId(), null, null));

        assertThat(paid.ticketId()).isNotNull();
        assertThat(paid.cashAmount()).isZero();
        assertThat(paid.tokenAmount()).isEqualTo(PRICE);
        verify(tossPaymentsClient, never()).confirm(anyString(), anyString(), anyInt(), anyString());
        assertThat(seatStatus()).isEqualTo("SOLD");
    }

    @Test
    void 같은_승인을_다시_보내도_티켓은_한_장이다() {
        givenChainBalance(11_401);
        var order = ticketOrderService.open(userId, detailId, seatId);
        givenTossApproves(order.orderId(), order.cashAmount());
        givenBurnAccepted();

        TicketOrderResponse first = ticketOrderService.confirm(userId, confirmRequest(order));
        TicketOrderResponse second = ticketOrderService.confirm(userId, confirmRequest(order));

        assertThat(second.ticketId()).isEqualTo(first.ticketId());
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM tickets", Long.class)).isEqualTo(1L);
        assertThat(countCatTransactions("BURN", "PAYMENT")).isEqualTo(1L);
    }

    @Test
    void 토스가_거절하면_묶어둔_캣머니를_풀어준다() {
        givenChainBalance(11_401);
        var order = ticketOrderService.open(userId, detailId, seatId);
        willThrow(new TossPaymentException("REJECT_CARD_COMPANY", "카드사 거절"))
                .given(tossPaymentsClient).confirm(anyString(), anyString(), anyInt(), anyString());

        assertThatThrownBy(() -> ticketOrderService.confirm(userId, confirmRequest(order)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PaymentErrorCode.PAYMENT_APPROVAL_FAILED);

        assertThat(orderStatus(order.ticketOrderId())).isEqualTo("FAILED");
        // 묶인 돈이 남아 있으면 사용자는 실패했는데도 그 잔액을 못 쓴다
        assertThat(holdStatus(order.ticketOrderId())).isEqualTo("RELEASED");
        assertThat(seatStatus()).isEqualTo("HELD");
        assertThat(countCatTransactions("BURN", "PAYMENT")).isZero();
    }

    @Test
    void 소각이_실패해도_티켓은_유효하고_재시도_대상으로_남는다() {
        givenChainBalance(11_401);
        var order = ticketOrderService.open(userId, detailId, seatId);
        givenTossApproves(order.orderId(), order.cashAmount());
        willThrow(new IllegalStateException("체인 연결 실패"))
                .given(catMoneyClient).burn(anyString(), anyString(), anyInt(), any(), any());

        TicketOrderResponse paid = ticketOrderService.confirm(userId, confirmRequest(order));

        assertThat(paid.ticketId()).isNotNull();
        assertThat(orderStatus(order.ticketOrderId())).isEqualTo("PAID");
        assertThat(burnTxIdOf(order.ticketOrderId())).isNull();

        givenBurnAccepted();
        ticketOrderService.sendBurn(order.ticketOrderId());
        assertThat(burnTxIdOf(order.ticketOrderId())).isNotNull();
    }

    @Test
    void 승인_전에_선점이_만료됐으면_토스를_부르지_않는다() {
        givenChainBalance(0);
        var order = ticketOrderService.open(userId, detailId, seatId);
        jdbcTemplate.update("UPDATE performance_seats SET held_until = now() - interval '1 minute'"
                + " WHERE performance_detail_id = ? AND seat_id = ?", detailId, seatId);

        assertThatThrownBy(() -> ticketOrderService.confirm(userId, confirmRequest(order)))
                .isInstanceOf(BusinessException.class);

        verify(tossPaymentsClient, never()).confirm(anyString(), anyString(), anyInt(), anyString());
    }

    @Test
    void 남의_주문은_승인할_수_없다() {
        givenChainBalance(0);
        var order = ticketOrderService.open(userId, detailId, seatId);
        Long otherUserId = insertOtherUser();

        assertThatThrownBy(() -> ticketOrderService.confirm(otherUserId, confirmRequest(order)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PaymentErrorCode.PAYMENT_OWNER_MISMATCH);
    }

    // ── 대역 ────────────────────────────────────────────────

    private void givenTossApproves(String orderId, int amount) {
        willReturn(new TossPaymentResult("pk-" + orderId, orderId, "DONE", amount, "카드",
                OffsetDateTime.now(), new TossPaymentResult.Receipt("https://receipt.example/1")))
                .given(tossPaymentsClient).confirm(anyString(), anyString(), anyInt(), anyString());
    }

    private void givenIssueAccepted() {
        willReturn(new TicketIssueResult("PENDING",
                "0x3333333333333333333333333333333333333333333333333333333333333333", "12"))
                .given(blockchainTicketClient).issue(any(), anyString());
    }

    private void givenBurnAccepted() {
        willReturn(new CatMoneyWriteResult("PENDING",
                "0x2222222222222222222222222222222222222222222222222222222222222222"))
                .given(catMoneyClient).burn(anyString(), anyString(), anyInt(), any(), any());
    }

    private TicketOrderConfirmRequest confirmRequest(TicketOrderPrepareResponse order) {
        return new TicketOrderConfirmRequest(order.ticketOrderId(), "payment-key", order.cashAmount());
    }

    private void givenChainBalance(long balance) {
        willReturn(new CatMoneyBalanceResult("0x1111111111111111111111111111111111111111",
                Long.toString(balance), 0, "TCAT"))
                .given(catMoneyClient).getBalance(anyString());
    }

    // ── 픽스처 ──────────────────────────────────────────────

    private Long insertUserWithFaceAndWallet() {
        Long faceId = jdbcTemplate.queryForObject(
                "INSERT INTO faces (embedding, model_version)"
                        + " VALUES (array_fill(0.1::real, ARRAY[128])::vector, 'test-1')"
                        + " RETURNING id", Long.class);
        Long id = jdbcTemplate.queryForObject("""
                INSERT INTO users (email, password, name, nickname, phone, role, face_id)
                VALUES ('buyer@test.com', 'x', '구매자', '구매자', '010-0000-0000', 'USER'::user_role, ?)
                RETURNING id
                """, Long.class, faceId);
        Long ownerId = jdbcTemplate.queryForObject("""
                INSERT INTO wallet_owners (user_id, derivation_index, owner_address, key_version, status)
                VALUES (?, 0, '0x1111111111111111111111111111111111111111', 1, 'ACTIVE') RETURNING id
                """, Long.class, id);
        jdbcTemplate.update("""
                INSERT INTO wallets (owner_id, chain_id, type, address, status, deployed)
                VALUES (?, 31221, 'RELAYER_EOA', '0x1111111111111111111111111111111111111111', 'ACTIVE', false)
                """, ownerId);
        return id;
    }

    private Fixture insertPerformanceFixture() {
        Long stadiumId = jdbcTemplate.queryForObject(
                "INSERT INTO stadiums (name, address) VALUES ('테스트 공연장', '서울') RETURNING id", Long.class);
        Long areaId = jdbcTemplate.queryForObject("""
                INSERT INTO areas (stadium_id, area_code, type, max_seat)
                VALUES (?, 'A', 'SEATED', 1000) RETURNING id
                """, Long.class, stadiumId);
        Long performanceId = jdbcTemplate.queryForObject("""
                INSERT INTO performance_general (stadium_id, visible_from, title, ticketing_start_at, status)
                VALUES (?, now(), '테아캣 콘서트', now() - interval '1 day', 'UPCOMING'::performance_status)
                RETURNING id
                """, Long.class, stadiumId);
        jdbcTemplate.update("""
                INSERT INTO performance_areas (performance_general_id, area_id, grade, price, max_cnt)
                VALUES (?, ?, 'VIP', ?, 100)
                """, performanceId, areaId, PRICE);
        Long detail = insertPerformanceDetail(1);
        Long seat = insertSeat("3", 12);
        insertPerformanceSeat(detail, seat);
        return new Fixture(detail, seat);
    }

    private Long insertPerformanceDetail(int performanceNum) {
        Long performanceId = jdbcTemplate.queryForObject(
                "SELECT id FROM performance_general LIMIT 1", Long.class);
        return jdbcTemplate.queryForObject("""
                INSERT INTO performance_details (performance_general_id, performance_num, performance_date, status)
                VALUES (?, ?, now() + interval '7 day', 'OPEN'::ticketing_status) RETURNING id
                """, Long.class, performanceId, performanceNum);
    }

    private Long insertSeat(String rowLabel, int seatNumber) {
        Long areaId = jdbcTemplate.queryForObject("SELECT id FROM areas LIMIT 1", Long.class);
        return jdbcTemplate.queryForObject("""
                INSERT INTO seats (area_id, row_label, seat_number) VALUES (?, ?, ?) RETURNING id
                """, Long.class, areaId, rowLabel, seatNumber);
    }

    private void insertPerformanceSeat(Long detailId, Long seatId) {
        jdbcTemplate.update("""
                INSERT INTO performance_seats (performance_detail_id, seat_id, status)
                VALUES (?, ?, 'AVAILABLE'::seat_booking_status)
                """, detailId, seatId);
    }

    private void holdSeat(Long userId, Long detailId, Long seatId) {
        jdbcTemplate.update("""
                UPDATE performance_seats
                   SET status = 'HELD'::seat_booking_status, held_by = ?, held_until = now() + interval '10 minute'
                 WHERE performance_detail_id = ? AND seat_id = ?
                """, userId, detailId, seatId);
    }

    private Long insertOtherUser() {
        Long faceId = jdbcTemplate.queryForObject(
                "INSERT INTO faces (embedding, model_version)"
                        + " VALUES (array_fill(0.2::real, ARRAY[128])::vector, 'test-1') RETURNING id",
                Long.class);
        return jdbcTemplate.queryForObject("""
                INSERT INTO users (email, password, name, nickname, phone, role, face_id)
                VALUES ('other@test.com', 'x', '남', '남', '010-1111-1111', 'USER'::user_role, ?)
                RETURNING id
                """, Long.class, faceId);
    }

    private String seatStatus() {
        return jdbcTemplate.queryForObject("SELECT status::text FROM performance_seats"
                + " WHERE performance_detail_id = ? AND seat_id = ?", String.class, detailId, seatId);
    }

    private String orderStatus(Long ticketOrderId) {
        return jdbcTemplate.queryForObject("SELECT status::text FROM ticket_orders WHERE id = ?",
                String.class, ticketOrderId);
    }

    private String holdStatus(Long ticketOrderId) {
        return jdbcTemplate.queryForObject("SELECT status::text FROM cat_money_holds"
                + " WHERE ref_type = 'TICKET_ORDER' AND ref_id = ?", String.class, ticketOrderId);
    }

    private Long burnTxIdOf(Long ticketOrderId) {
        return jdbcTemplate.queryForObject("SELECT burn_tx_id FROM ticket_orders WHERE id = ?",
                Long.class, ticketOrderId);
    }

    private Long countCatTransactions(String direction, String reason) {
        return jdbcTemplate.queryForObject(
                "SELECT count(*) FROM cat_transactions WHERE direction::text = ? AND reason::text = ?",
                Long.class, direction, reason);
    }

    private Long countPayments() {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM payments", Long.class);
    }

    private Long countHolds() {
        return jdbcTemplate.queryForObject(
                "SELECT count(*) FROM cat_money_holds WHERE status = 'ACTIVE'", Long.class);
    }

    private record Fixture(Long detailId, Long seatId) {
    }
}
