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
import com.teacat.server.payment.service.TicketCancelService;
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
import java.util.Map;

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
        "nft.auction.sweep-enabled=false",
        /* 🔴 픽스처가 지갑을 31221 로 넣으므로 여기서 못 박습니다. 이 줄이 없으면
           로컬 체인(31337)을 쓰려고 server/.env 에 BLOCKCHAIN_CHAIN_ID 를 넣어 둔 사람의
           기계에서만 이 클래스가 통째로 "지갑이 없습니다" 로 무너집니다 — 실제로 겪었고,
           원인이 테스트 바깥에 있어서 찾는 데 오래 걸립니다 */
        "blockchain.chain-id=31221",
        // 기본값과 다른 값으로 둔다 — 개봉 시각·취소 마감 테스트가 실제로 이 설정을
        // 읽어서 계산하는지, 기본값을 하드코딩해 우연히 통과하는 게 아닌지를 가려낸다
        "booking.policy.cancel-deadline-lead=7m"
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
    private TicketCancelService ticketCancelService;

    @Autowired
    private TicketOrderScheduler ticketOrderScheduler;

    @Autowired
    private com.teacat.server.ticket.service.TicketQueryService ticketQueryService;

    @Autowired
    private com.teacat.server.payment.service.TicketCancelRecorder ticketCancelRecorder;

    @Autowired
    private com.teacat.server.ticket.service.TicketIssueService ticketIssueService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private com.teacat.server.common.config.BookingPolicyProperties bookingPolicy;

    private Long userId;
    private Long detailId;
    private Long seatId;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("""
                TRUNCATE TABLE users, faces, stadiums, performance_general, wallet_owners, wallets,
                               cat_money_holds, cat_transactions, payments, payment_cancels, ticket_orders, tickets, nft_tickets,
                               nft_photocard_packs
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
    void 결제창을_닫았다가_다시_결제해도_주문은_하나다() {
        givenChainBalance(11_401);
        TicketOrderPrepareResponse first = ticketOrderService.open(userId, detailId, seatId);

        // 결제를 다시 누르면 프론트가 준비 API 를 또 부른다.
        // 주문을 새로 만들려 하면 uq_ticket_orders_pending_seat 에 걸려 터진다
        TicketOrderPrepareResponse again = ticketOrderService.open(userId, detailId, seatId);

        assertThat(again.ticketOrderId()).isEqualTo(first.ticketOrderId());
        assertThat(again.orderId()).isEqualTo(first.orderId());
        assertThat(again.tokenAmount()).isEqualTo(first.tokenAmount());
        assertThat(countTicketOrders()).isEqualTo(1);
        // 같은 돈이 두 번 묶이면 쓸 수 있는 잔액만 사라진다
        assertThat(countActiveHolds()).isEqualTo(1);
    }

    @Test
    void 선점을_잃은_남의_주문은_정리되고_그_좌석으로_다시_주문할_수_있다() {
        givenChainBalance(0);
        // 남이 주문을 열어둔 채 사라졌고, 그 선점이 만료돼 좌석은 내가 잡았다
        Long staleOrderId = insertPendingOrderOf(insertOtherUser());

        TicketOrderPrepareResponse mine = ticketOrderService.open(userId, detailId, seatId);

        assertThat(mine.ticketOrderId()).isNotEqualTo(staleOrderId);
        assertThat(orderStatus(staleOrderId)).isEqualTo("FAILED");
        assertThat(paymentStatusOf(staleOrderId)).isEqualTo("ABORTED");
    }

    @Test
    void 버려진_주문은_배치가_닫고_묶인_캣머니를_풀어준다() {
        givenChainBalance(11_401);
        TicketOrderPrepareResponse order = ticketOrderService.open(userId, detailId, seatId);
        expireHold();

        ticketOrderScheduler.expireStalePendingOrders();

        assertThat(orderStatus(order.ticketOrderId())).isEqualTo("FAILED");
        assertThat(holdStatus(order.ticketOrderId())).isEqualTo("RELEASED");
        assertThat(paymentStatusOf(order.ticketOrderId())).isEqualTo("ABORTED");
    }

    @Test
    void 선점이_살아있는_주문은_배치가_건드리지_않는다() {
        givenChainBalance(11_401);
        TicketOrderPrepareResponse order = ticketOrderService.open(userId, detailId, seatId);

        ticketOrderScheduler.expireStalePendingOrders();

        assertThat(orderStatus(order.ticketOrderId())).isEqualTo("PENDING");
        assertThat(holdStatus(order.ticketOrderId())).isEqualTo("ACTIVE");
    }

    @Test
    void 승인을_보낸_주문은_선점이_만료돼도_배치가_건드리지_않는다() {
        givenChainBalance(0);
        TicketOrderPrepareResponse order = ticketOrderService.open(userId, detailId, seatId);
        // 승인은 보냈는데 그 뒤 처리가 실패한 주문. 닫아 버리면 다시 승인해 되살릴 길이 막힌다
        jdbcTemplate.update("UPDATE payments SET status = 'IN_PROGRESS'::payment_status"
                + " WHERE order_id = ?", order.orderId());
        expireHold();

        ticketOrderScheduler.expireStalePendingOrders();

        assertThat(orderStatus(order.ticketOrderId())).isEqualTo("PENDING");
    }

    @Test
    void 판매에서_빠진_좌석으로는_주문할_수_없다() {
        givenChainBalance(0);
        // 선점한 뒤 운영이 좌석을 막은 상황. 선점이 남아 있어도 팔 수 있는 좌석이 아니다
        jdbcTemplate.update("UPDATE performance_seats SET status = 'BLOCKED'::seat_booking_status"
                + " WHERE performance_detail_id = ? AND seat_id = ?", detailId, seatId);

        assertThatThrownBy(() -> ticketOrderService.open(userId, detailId, seatId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(BookingErrorCode.SEAT_ALREADY_SOLD);

        assertThat(countPayments()).isZero();
        assertThat(countTicketOrders()).isZero();
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

    @Test
    void 취소하면_예매가_무효화되고_좌석이_풀린다() {
        TicketOrderResponse paid = payTicket();
        givenTossCancels();
        givenRefundAccepted();

        ticketCancelService.cancel(userId, paid.ticketOrderId());

        // 무효화가 환불보다 먼저다. 응답 시점에 좌석은 이미 남이 살 수 있어야 한다
        assertThat(ticketStatus(paid.ticketId())).isEqualTo("CANCELLED");
        assertThat(orderStatus(paid.ticketOrderId())).isEqualTo("CANCELED");
        assertThat(seatStatus()).isEqualTo("AVAILABLE");
    }

    /**
     * 🔴 <b>대기자가 있을 때의 취소</b>. 위 테스트는 대기자가 없는 길만 지나가므로
     * 추첨을 만드는 쪽(SeatDrawWriter)이 통째로 빠집니다 — 운영에서 취소가 500 으로
     * 터진 것이 이 길이었습니다.
     */
    @Test
    void 구역에_대기자가_있으면_좌석을_풀지_않고_추첨을_연다() {
        TicketOrderResponse paid = payTicket();
        givenTossCancels();
        givenRefundAccepted();
        insertWaitingResaleEntry();

        ticketCancelService.cancel(userId, paid.ticketOrderId());

        assertThat(ticketStatus(paid.ticketId())).isEqualTo("CANCELLED");
        assertThat(orderStatus(paid.ticketOrderId())).isEqualTo("CANCELED");
        // 좌석은 대기자 몫이다. 예매 화면에 다시 뜨면 안 된다
        assertThat(seatStatus()).isEqualTo("SOLD");
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM seat_draws", Integer.class))
                .isEqualTo(1);
    }

    /**
     * 🔴 <b>한 번 추첨이 돌았던 좌석을 다시 취소</b>. 당첨자가 산 좌석을 그 사람이 다시
     * 취소하는, 아주 평범한 흐름입니다.
     *
     * <p>추첨 회차를 늘 1 로 시작하던 때는 여기서 {@code uq_seat_draws_draw_key} 에 걸려
     * <b>취소가 통째로 500</b> 이었습니다. 회차가 이어지는지를 봅니다.
     */
    @Test
    void 추첨이_한_번_돌았던_좌석도_다시_취소할_수_있다() {
        insertWaitingResaleEntry();

        // 첫 번째 취소 — 추첨 n1 이 열린다
        TicketOrderResponse first = payTicket();
        givenTossCancels();
        givenRefundAccepted();
        ticketCancelService.cancel(userId, first.ticketOrderId());
        markDrawFinished();

        // 같은 좌석을 다시 사서 다시 취소한다
        releaseSeat();
        holdSeat(userId, detailId, seatId);
        TicketOrderResponse second = payTicket();

        ticketCancelService.cancel(userId, second.ticketOrderId());

        assertThat(orderStatus(second.ticketOrderId())).isEqualTo("CANCELED");
        assertThat(jdbcTemplate.queryForList("SELECT draw_key FROM seat_draws ORDER BY id", String.class))
                .hasSize(2)
                .satisfies(keys -> {
                    assertThat(keys.get(0)).endsWith(":n1");
                    assertThat(keys.get(1)).endsWith(":n2");
                });
    }

    /** 첫 추첨을 끝난 상태로 만든다 — 좌석에 도는 추첨이 있으면 새로 열지 않기 때문 */
    private void markDrawFinished() {
        jdbcTemplate.update("UPDATE seat_draws SET status = 'SETTLED'::seat_draw_status");
    }

    private void releaseSeat() {
        jdbcTemplate.update("""
                UPDATE performance_seats SET status = 'AVAILABLE'::seat_booking_status,
                       held_by = NULL, held_until = NULL
                 WHERE performance_detail_id = ? AND seat_id = ?
                """, detailId, seatId);
    }

    @Test
    void 취소하면_카드가_취소되고_캣머니가_환급된다() {
        TicketOrderResponse paid = payTicket();
        givenTossCancels();
        givenRefundAccepted();

        ticketCancelService.cancel(userId, paid.ticketOrderId());

        assertThat(paymentStatusOf(paid.ticketOrderId())).isEqualTo("CANCELED");
        assertThat(canceledAmountOf(paid.ticketOrderId())).isEqualTo(PRICE - 11_401);
        assertThat(countPaymentCancels()).isEqualTo(1L);
        // 환급은 소각이 아니라 발행이다 — 캣머니는 트레저리를 두지 않는다
        assertThat(countCatTransactions("MINT", "REFUND")).isEqualTo(1L);
    }

    @Test
    void 취소하면_NFT_가_소각됨으로_표시된다() {
        TicketOrderResponse paid = payTicket();
        // 발행이 확정된 상태여야 태울 수 있다. 실제로는 블록체인 서비스가 상태와 tokenId 를
        // 함께 쓰므로, tokenId 없이 MINTED 만 있는 행은 생기지 않는다
        jdbcTemplate.update("UPDATE nft_tickets SET status = 'MINTED'::nft_mint_status,"
                + " token_id = 12, mint_tx_hash = '0x11'");
        givenTossCancels();
        givenRefundAccepted();
        willReturn(new TicketIssueResult("PENDING", "0x55", "12"))
                .given(blockchainTicketClient).burn(anyString());

        ticketCancelService.cancel(userId, paid.ticketOrderId());

        // MINTED 로 남으면 응답만 보고는 소각 여부를 알 수 없다
        assertThat(nftStatus()).isEqualTo("BURNED");
        assertThat(ticketQueryService.getMyTicket(userId, paid.ticketId()).nftStatus())
                .isEqualTo("BURNED");
    }

    @Test
    void 같은_예매를_두_번_취소할_수_없다() {
        TicketOrderResponse paid = payTicket();
        givenTossCancels();
        givenRefundAccepted();
        ticketCancelService.cancel(userId, paid.ticketOrderId());

        assertThatThrownBy(() -> ticketCancelService.cancel(userId, paid.ticketOrderId()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PaymentErrorCode.ALREADY_CANCELED);

        // 두 번 환불되면 안 된다
        assertThat(countPaymentCancels()).isEqualTo(1L);
        assertThat(countCatTransactions("MINT", "REFUND")).isEqualTo(1L);
    }

    @Test
    void 카드_취소가_실패해도_예매는_취소되고_재시도_대상으로_남는다() {
        TicketOrderResponse paid = payTicket();
        givenRefundAccepted();
        willThrow(new TossPaymentException("ALREADY_CANCELED_PAYMENT", "취소 실패"))
                .given(tossPaymentsClient).cancel(anyString(), anyString(), any(), anyString());

        ticketCancelService.cancel(userId, paid.ticketOrderId());

        // 사용자에게 "취소 실패" 를 보여주면 다시 누른다. 취소는 성공이어야 한다
        assertThat(orderStatus(paid.ticketOrderId())).isEqualTo("CANCELED");
        assertThat(seatStatus()).isEqualTo("AVAILABLE");
        assertThat(countPaymentCancels()).isZero();
        // 돌려줘야 할 돈이 남았다는 사실이 조회로 잡혀야 한다
        assertThat(ticketCancelRecorder.findUnrefundedCards(org.springframework.data.domain.Limit.of(10)))
                .contains(paid.ticketOrderId());

        givenTossCancels();
        ticketCancelService.cancelCard(paid.ticketOrderId());
        assertThat(countPaymentCancels()).isEqualTo(1L);
    }

    @Test
    void 캣머니_환급이_실패해도_예매는_취소되고_재시도_대상으로_남는다() {
        TicketOrderResponse paid = payTicket();
        givenTossCancels();
        willThrow(new IllegalStateException("체인 연결 실패"))
                .given(catMoneyClient).mint(anyString(), anyString(), any(), any());

        ticketCancelService.cancel(userId, paid.ticketOrderId());

        assertThat(orderStatus(paid.ticketOrderId())).isEqualTo("CANCELED");
        assertThat(countCatTransactions("MINT", "REFUND")).isZero();
        assertThat(ticketCancelRecorder.findUnrefundedTokens(org.springframework.data.domain.Limit.of(10)))
                .contains(paid.ticketOrderId());

        givenRefundAccepted();
        ticketCancelService.refundToken(paid.ticketOrderId());
        assertThat(countCatTransactions("MINT", "REFUND")).isEqualTo(1L);
    }

    @Test
    void 공연이_시작된_뒤에는_취소할_수_없다() {
        TicketOrderResponse paid = payTicket();
        jdbcTemplate.update("UPDATE performance_details SET performance_date = now() - interval '1 minute'"
                + " WHERE id = ?", detailId);

        assertThatThrownBy(() -> ticketCancelService.cancel(userId, paid.ticketOrderId()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PaymentErrorCode.CANCEL_DEADLINE_PASSED);

        assertThat(orderStatus(paid.ticketOrderId())).isEqualTo("PAID");
        assertThat(seatStatus()).isEqualTo("SOLD");
    }

    @Test
    void 취소_마감을_지나면_취소할_수_없다() {
        TicketOrderResponse paid = payTicket();
        // 마감(공연 시작 − cancelDeadlineLead) 안쪽(lead − 1분 뒤)으로 공연을 당긴다 — 이미 지났다
        long insideDeadlineMinutes = bookingPolicy.cancelDeadlineLead().toMinutes() - 1;
        jdbcTemplate.update(
                ("UPDATE performance_details SET performance_date = now() + interval '%d minute' WHERE id = ?")
                        .formatted(insideDeadlineMinutes),
                detailId);

        assertThatThrownBy(() -> ticketCancelService.cancel(userId, paid.ticketOrderId()))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", PaymentErrorCode.CANCEL_DEADLINE_PASSED);
    }

    @Test
    void 취소_마감_전까지는_취소할_수_있다() {
        TicketOrderResponse paid = payTicket();
        givenTossCancels();
        givenRefundAccepted();
        // 마감 바깥(lead + 1분 뒤)으로 공연을 당긴다 — 아직 취소할 수 있어야 한다
        long outsideDeadlineMinutes = bookingPolicy.cancelDeadlineLead().toMinutes() + 1;
        jdbcTemplate.update(
                ("UPDATE performance_details SET performance_date = now() + interval '%d minute' WHERE id = ?")
                        .formatted(outsideDeadlineMinutes),
                detailId);

        ticketCancelService.cancel(userId, paid.ticketOrderId());

        assertThat(orderStatus(paid.ticketOrderId())).isEqualTo("CANCELED");
    }

    @Test
    void 남의_예매는_취소할_수_없다() {
        TicketOrderResponse paid = payTicket();
        Long otherUserId = insertOtherUser();

        assertThatThrownBy(() -> ticketCancelService.cancel(otherUserId, paid.ticketOrderId()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PaymentErrorCode.PAYMENT_OWNER_MISMATCH);

        assertThat(orderStatus(paid.ticketOrderId())).isEqualTo("PAID");
    }

    @Test
    void 취소된_좌석을_다시_살_수_있다() {
        TicketOrderResponse first = payTicket();
        givenTossCancels();
        givenRefundAccepted();
        ticketCancelService.cancel(userId, first.ticketOrderId());

        // 좌석이 풀렸으니 같은 좌석을 다시 살 수 있어야 한다.
        // (회차, 좌석)에 통째로 걸린 유니크 제약이 있으면 여기서 발권이 깨진다 —
        // 결제는 끝났는데 티켓이 없는 상태가 된다
        holdSeat(userId, detailId, seatId);
        givenChainBalance(0);
        var order = ticketOrderService.open(userId, detailId, seatId);
        givenTossApproves(order.orderId(), order.cashAmount());
        givenIssueAccepted();

        TicketOrderResponse second = ticketOrderService.confirm(userId, confirmRequest(order));

        assertThat(second.ticketId()).isNotEqualTo(first.ticketId());
        assertThat(seatStatus()).isEqualTo("SOLD");
        // 취소된 티켓은 이력으로 남는다
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM tickets", Long.class)).isEqualTo(2L);
    }

    @Test
    void 승인은_됐는데_처리가_실패한_결제를_다시_승인해서_되살릴_수_있다() {
        givenChainBalance(0);
        var order = ticketOrderService.open(userId, detailId, seatId);
        givenTossApproves(order.orderId(), order.cashAmount());
        givenIssueAccepted();

        // 토스 승인은 나갔는데 그 뒤 처리가 실패해 IN_PROGRESS 로 굳은 상태를 만든다.
        // (실제로 발권이 유니크 제약에 걸려 이렇게 남는 것을 실결제에서 겪었다)
        jdbcTemplate.update("UPDATE payments SET status = 'IN_PROGRESS'::payment_status"
                + " WHERE order_id = ?", order.orderId());

        // 다시 선점할 수 없으면 "돈은 빠졌는데 티켓이 없는" 상태가 영구히 굳는다.
        // 재승인이 안전한 이유는 주문번호를 멱등 키로 보내 토스가 두 번 승인하지 않기 때문이다
        TicketOrderResponse recovered = ticketOrderService.confirm(userId, confirmRequest(order));

        assertThat(recovered.ticketId()).isNotNull();
        assertThat(paymentStatus(order.orderId())).isEqualTo("DONE");
        assertThat(seatStatus()).isEqualTo("SOLD");
    }

    @Test
    void 티켓을_사면_카드팩이_그_회차의_것으로_하나_생긴다() {
        TicketOrderResponse paid = payTicket();

        Map<String, Object> pack = jdbcTemplate.queryForMap("""
                SELECT source::text AS source, source_ref, performance_detail_id, consumed_at
                  FROM nft_photocard_packs WHERE user_id = ?
                """, userId);
        assertThat(pack.get("source")).isEqualTo("TICKET_PURCHASE");
        assertThat(pack.get("source_ref")).isEqualTo(paid.ticketId().toString());
        assertThat(pack.get("consumed_at")).isNull();
        assertThat(pack.get("performance_detail_id")).isEqualTo(detailId);

        // 개봉 판정 = 공연 시작 − booking.policy.cancel-deadline-lead ≤ now() (테스트 설정: 7분)
        long insideDeadlineMinutes = bookingPolicy.cancelDeadlineLead().toMinutes() - 1;
        jdbcTemplate.update(
                ("UPDATE performance_details SET performance_date = now() + interval '%d minute' WHERE id = ?")
                        .formatted(insideDeadlineMinutes), detailId);
        assertThat(isPackOpenable(userId)).isTrue();

        long outsideDeadlineMinutes = bookingPolicy.cancelDeadlineLead().toMinutes() + 1;
        jdbcTemplate.update(
                ("UPDATE performance_details SET performance_date = now() + interval '%d minute' WHERE id = ?")
                        .formatted(outsideDeadlineMinutes), detailId);
        assertThat(isPackOpenable(userId)).isFalse();
    }

    /** 그 사용자의 미소비 팩이 지금 열 수 있는지. 경계 계산은 하드코딩하지 않고 설정값을 그대로 쓴다 */
    private boolean isPackOpenable(Long userId) {
        long leadMinutes = bookingPolicy.cancelDeadlineLead().toMinutes();
        return jdbcTemplate.queryForObject("""
                SELECT (d.performance_date - (%d * interval '1 minute')) <= now()
                  FROM nft_photocard_packs p
                  JOIN performance_details d ON d.id = p.performance_detail_id
                 WHERE p.user_id = ? AND p.consumed_at IS NULL
                """.formatted(leadMinutes), Boolean.class, userId);
    }

    @Test
    void 예매를_취소하면_안_연_카드팩이_사라진다() {
        TicketOrderResponse paid = payTicket();
        givenTossCancels();
        givenRefundAccepted();
        assertThat(countPacks()).isEqualTo(1L);

        ticketCancelService.cancel(userId, paid.ticketOrderId());

        // 벌크 delete 는 ticket.cancel()/order.markCanceled() 가 flush 됐는지와 무관하게
        // 성공하므로, 팩이 사라졌다는 것만으로는 취소 자체가 반영됐는지 알 수 없다
        assertThat(ticketStatus(paid.ticketId())).isEqualTo("CANCELLED");
        assertThat(orderStatus(paid.ticketOrderId())).isEqualTo("CANCELED");
        assertThat(countPacks()).isZero();
    }

    private Long countPacks() {
        return jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nft_photocard_packs WHERE user_id = ?", Long.class, userId);
    }

    @Test
    void 카드팩을_이미_열었으면_회차를_연기해도_취소할_수_없다() {
        TicketOrderResponse paid = payTicket();
        // 팩이 열리도록 뽑은 것처럼 팩을 소비 처리한다. chk_nft_photocard_packs_consumed 가
        // consumed_at 이 있으면 photocard_id · idempotency_key 도 있을 것을 요구하므로,
        // 실제 카드 행을 만들어 photocard_id 를 채운다
        Long photocardId = insertDrawnPhotocard(paid.ticketId());
        jdbcTemplate.update("""
                UPDATE nft_photocard_packs
                   SET consumed_at = now(), photocard_id = ?, idempotency_key = gen_random_uuid()
                 WHERE user_id = ?
                """, photocardId, userId);
        // 주최자가 공연을 한참 뒤로 미뤄 취소 마감이 되돌아온 상황
        jdbcTemplate.update(
                "UPDATE performance_details SET performance_date = now() + interval '30 day' WHERE id = ?",
                detailId);

        assertThatThrownBy(() -> ticketCancelService.cancel(userId, paid.ticketOrderId()))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", PaymentErrorCode.PACK_ALREADY_OPENED);

        // 취소가 실제로 안 됐는지 확인한다
        assertThat(orderStatus(paid.ticketOrderId())).isEqualTo("PAID");
        assertThat(ticketStatus(paid.ticketId())).isEqualTo("CONFIRMED");
    }

    /** 이 티켓으로 이미 뽑은 것처럼 보이는 카드 한 장. FK 를 만족시키려고 도안도 함께 넣는다 */
    private Long insertDrawnPhotocard(Long ticketId) {
        Long performanceId = jdbcTemplate.queryForObject(
                "SELECT performance_general_id FROM performance_details WHERE id = ?", Long.class, detailId);
        Long designId = jdbcTemplate.queryForObject("""
                INSERT INTO nft_photocard_designs (performance_general_id, name, image_url, total_supply)
                VALUES (?, '테스트 도안', '/test.png', 1) RETURNING id
                """, Long.class, performanceId);
        return jdbcTemplate.queryForObject("""
                INSERT INTO nft_photocards (design_id, ticket_id, owner_id, status)
                VALUES (?, ?, ?, 'PENDING') RETURNING id
                """, Long.class, designId, ticketId, userId);
    }

    // ── 대역 ────────────────────────────────────────────────

    private void givenTossApproves(String orderId, int amount) {
        willReturn(new TossPaymentResult("pk-" + orderId, orderId, "DONE", amount, "카드",
                OffsetDateTime.now(), new TossPaymentResult.Receipt("https://receipt.example/1")))
                .given(tossPaymentsClient).confirm(anyString(), anyString(), anyInt(), anyString());
    }

    private void givenTossCancels() {
        willReturn(new TossPaymentResult("pk-canceled", "order", "CANCELED", PRICE - 11_401, "카드",
                OffsetDateTime.now(), null))
                .given(tossPaymentsClient).cancel(anyString(), anyString(), any(), anyString());
    }

    private void givenRefundAccepted() {
        willReturn(new CatMoneyWriteResult("PENDING",
                "0x4444444444444444444444444444444444444444444444444444444444444444"))
                .given(catMoneyClient).mint(anyString(), anyString(), any(), any());
    }

    /** 카드+캣머니로 결제를 끝낸 티켓 하나 */
    private TicketOrderResponse payTicket() {
        givenChainBalance(11_401);
        var order = ticketOrderService.open(userId, detailId, seatId);
        givenTossApproves(order.orderId(), order.cashAmount());
        givenBurnAccepted();
        givenIssueAccepted();
        return ticketOrderService.confirm(userId, confirmRequest(order));
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
                "INSERT INTO stadiums (name, address, max_capacity) "
                        + "VALUES ('테스트 공연장', '서울', 100000) RETURNING id", Long.class);
        // 구역과 공연은 배치도에 매인다 (S15P21A402-53)
        Long layoutId = jdbcTemplate.queryForObject("""
                INSERT INTO stadium_layouts (stadium_id, name, width, height, is_default, status)
                VALUES (?, '기본 배치', 1000, 1000, true, 'ACTIVE') RETURNING id
                """, Long.class, stadiumId);
        Long areaId = jdbcTemplate.queryForObject("""
                INSERT INTO areas (stadium_id, stadium_layout_id, area_code, type, max_seat)
                VALUES (?, ?, 'A', 'SEATED', 1000) RETURNING id
                """, Long.class, stadiumId, layoutId);
        Long performanceId = jdbcTemplate.queryForObject("""
                INSERT INTO performance_general
                    (stadium_id, stadium_layout_id, visible_from, title, ticketing_start_at, status)
                VALUES (?, ?, now(), '테아캣 콘서트', now() - interval '1 day', 'UPCOMING'::performance_status)
                RETURNING id
                """, Long.class, stadiumId, layoutId);
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

    /** 선점이 만료된 상황 */
    private void expireHold() {
        jdbcTemplate.update("UPDATE performance_seats SET held_until = now() - interval '1 minute'"
                + " WHERE performance_detail_id = ? AND seat_id = ?", detailId, seatId);
    }

    /** 결제창을 닫고 사라진 남의 주문. 그 선점은 이미 만료됐다 */
    private Long insertPendingOrderOf(Long ownerId) {
        Long paymentId = jdbcTemplate.queryForObject("""
                INSERT INTO payments (order_id, user_id, purpose, amount, status)
                VALUES ('tc_stale', ?, 'TICKET'::payment_purpose, ?, 'READY'::payment_status)
                RETURNING id
                """, Long.class, ownerId, PRICE);
        Long areaId = jdbcTemplate.queryForObject("SELECT id FROM areas LIMIT 1", Long.class);
        return jdbcTemplate.queryForObject("""
                INSERT INTO ticket_orders
                    (user_id, performance_detail_id, area_id, seat_id,
                     total_amount, token_amount, cash_amount, status, payment_id)
                VALUES (?, ?, ?, ?, ?, 0, ?, 'PENDING'::ticket_order_status, ?)
                RETURNING id
                """, Long.class, ownerId, detailId, areaId, seatId, PRICE, PRICE, paymentId);
    }

    /** 이 회차·구역에 취소표를 기다리는 사람 하나. 취소하면 좌석 대신 추첨이 열려야 한다 */
    private void insertWaitingResaleEntry() {
        /* 구매자 픽스처를 재사용하지 않습니다 — 이메일이 고정이라 두 번 부르면 UNIQUE 에 걸립니다 */
        Long waiterId = jdbcTemplate.queryForObject("""
                INSERT INTO users (email, password, name, nickname, phone, role)
                VALUES ('waiter@test.com', 'x', '대기자', '대기자', '010-0000-0001', 'USER'::user_role)
                RETURNING id
                """, Long.class);
        Long areaId = jdbcTemplate.queryForObject("SELECT id FROM areas LIMIT 1", Long.class);
        jdbcTemplate.update("""
                INSERT INTO resale_entries (user_id, performance_detail_id, area_id, status)
                VALUES (?, ?, ?, 'WAITING'::resale_entry_status)
                """, waiterId, detailId, areaId);
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

    private String ticketStatus(Long ticketId) {
        return jdbcTemplate.queryForObject("SELECT status::text FROM tickets WHERE id = ?",
                String.class, ticketId);
    }

    private String paymentStatusOf(Long ticketOrderId) {
        return jdbcTemplate.queryForObject("SELECT p.status::text FROM payments p"
                + " JOIN ticket_orders o ON o.payment_id = p.id WHERE o.id = ?",
                String.class, ticketOrderId);
    }

    private Integer canceledAmountOf(Long ticketOrderId) {
        return jdbcTemplate.queryForObject("SELECT p.canceled_amount FROM payments p"
                + " JOIN ticket_orders o ON o.payment_id = p.id WHERE o.id = ?",
                Integer.class, ticketOrderId);
    }

    private Long countPaymentCancels() {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM payment_cancels", Long.class);
    }

    private String nftStatus() {
        return jdbcTemplate.queryForObject("SELECT status::text FROM nft_tickets", String.class);
    }

    private String paymentStatus(String orderId) {
        return jdbcTemplate.queryForObject("SELECT status::text FROM payments WHERE order_id = ?",
                String.class, orderId);
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

    private Long countTicketOrders() {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM ticket_orders", Long.class);
    }

    private Long countActiveHolds() {
        return jdbcTemplate.queryForObject(
                "SELECT count(*) FROM cat_money_holds WHERE status = 'ACTIVE'", Long.class);
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
