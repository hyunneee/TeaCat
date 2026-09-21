package com.teacat.server.nft.service;

import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.NftDesignAllocationRequest;
import com.teacat.server.nft.dto.request.NftListingCreateRequest;
import com.teacat.server.nft.dto.request.NftMarketSort;
import com.teacat.server.nft.dto.request.NftPhotocardIssueRequest;
import com.teacat.server.nft.dto.response.NftCursorPageResponse;
import com.teacat.server.nft.dto.response.NftMarketPhotocardResponse;
import com.teacat.server.nft.dto.response.NftPhotocardIssueResponse;
import com.teacat.server.nft.client.PhotocardChainClient;
import com.teacat.server.nft.client.PhotocardIssueResult;
import com.teacat.server.wallet.client.CatMoneyBalanceResult;
import com.teacat.server.wallet.client.CatMoneyClient;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftMarketQueryRepository;
import com.teacat.server.performance.service.PerformanceService;
import com.teacat.server.ranking.service.RankingService;
import com.teacat.server.search.repository.SearchTrendRepository;
import com.teacat.server.search.service.SearchService;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.willReturn;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class NftServiceIntegrationTests {

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("pgvector/pgvector:pg18")
            .withDatabaseName("teacat_nft_test")
            .withUsername("teacat")
            .withPassword("teacat_test_pw")
            .withStartupTimeout(Duration.ofMinutes(2));

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        // 운영에서는 꺼져 있다(티켓 1장 = 카드 1장). 이 클래스는 스케줄러 자체를 검증하므로 켠다
        registry.add("nft.photocard.issue.scheduler-enabled", () -> "true");
    }

    @Autowired
    private NftService nftService;

    @Autowired
    private NftTradeSettlementWriter settlementWriter;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private org.springframework.test.web.servlet.MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private com.teacat.server.wallet.client.BlockchainProperties blockchainProperties;

    @Autowired
    private NftPhotocardIssuer photocardIssuer;

    @Autowired
    private NftPhotocardIssueScheduler photocardIssueScheduler;

    @Autowired
    private com.teacat.server.nft.repository.NftMarketQueryRepository nftMarketQueryRepository;

    @Autowired
    private PerformanceService performanceService;

    @Autowired
    private RankingService rankingService;

    @Autowired
    private SearchTrendRepository searchTrendRepository;

    @Autowired
    private SearchService searchService;

    /*
     * 체인은 붙이지 않는다. server/.env 가 테스트에서도 로드되므로 스텁으로 막지 않으면
     * 진짜 블록체인 서비스로 발행 요청이 나가 실제 체인에 카드가 민팅된다.
     */
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private com.teacat.server.nft.client.PhotocardChainClient photocardChainClient;

    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private CatMoneyClient catMoneyClient;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("TRUNCATE TABLE users, faces, stadiums RESTART IDENTITY CASCADE");
        willReturn(new CatMoneyBalanceResult("0x0000000000000000000000000000000000000000",
                "1000000000", 0, "CAT"))
                .given(catMoneyClient).getBalance(anyString());
    }

    @Test
    void 동시에_구매해도_한_건만_온체인_정산을_시작한다() throws Exception {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicket(sellerId, fixture);
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 1);
        Long photocardId = insertPhotocard(designId, ticketId, sellerId);
        insertListing(photocardId, sellerId, 3_000L);

        List<Long> buyerIds = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            buyerIds.add(insertUser("buyer" + i + "@test.com", "구매자" + i));
        }

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(buyerIds.size());
        List<Future<Long>> futures = new ArrayList<>();
        try {
            for (Long buyerId : buyerIds) {
                futures.add(executor.submit(() -> {
                    start.await();
                    try {
                        nftService.purchase(buyerId, photocardId, UUID.randomUUID().toString());
                        return buyerId;
                    } catch (BusinessException e) {
                        return null;
                    }
                }));
            }
            start.countDown();

            List<Long> winners = new ArrayList<>();
            for (Future<Long> future : futures) {
                Long result = future.get();
                if (result != null) {
                    winners.add(result);
                }
            }

            assertThat(winners).hasSize(1);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM nft_photocard_trades WHERE photocard_id = ?",
                    Long.class, photocardId)).isEqualTo(1L);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT owner_id FROM nft_photocards WHERE id = ?",
                    Long.class, photocardId)).isEqualTo(sellerId);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT status::text FROM nft_photocard_listings WHERE photocard_id = ?",
                    String.class, photocardId)).isEqualTo("SETTLING");
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT chain_status::text FROM nft_photocard_trades WHERE photocard_id = ?",
                    String.class, photocardId)).isEqualTo("PENDING");
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void 같은_멱등키로_구매를_재요청하면_같은_거래를_반환한다() {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Long buyerId = insertUser("buyer@test.com", "구매자");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicket(sellerId, fixture);
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 1);
        Long photocardId = insertPhotocard(designId, ticketId, sellerId);
        insertListing(photocardId, sellerId, 3_000L);
        String key = UUID.randomUUID().toString();

        var first = nftService.purchase(buyerId, photocardId, key);
        var second = nftService.purchase(buyerId, photocardId, key);

        assertThat(second.tradeId()).isEqualTo(first.tradeId());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nft_photocard_trades WHERE photocard_id = ?",
                Long.class, photocardId)).isEqualTo(1L);
    }

    @Test
    void 소유자는_판매를_등록하고_취소할_수_있다() {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicket(sellerId, fixture);
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 1);
        Long photocardId = insertPhotocard(designId, ticketId, sellerId);

        var listing = nftService.registerListing(
                sellerId, photocardId, new NftListingCreateRequest(3_000L, "스크래치 없는 카드입니다."));

        assertThat(listing.listingId()).isNotNull();
        var detail = nftService.getPhotocard(photocardId, sellerId);
        assertThat(detail.listing()).isNotNull();
        assertThat(detail.listing().sellerDescription()).isEqualTo("스크래치 없는 카드입니다.");
        assertThat(detail.issuedAt()).isNotNull();
        assertThat(detail.origin().seatGrade()).isEqualTo("VIP");
        assertThat(detail.origin().areaCode()).isEqualTo("A");
        assertThat(detail.origin().rowLabel()).isEqualTo("3");
        assertThat(detail.origin().seatNumber()).isEqualTo(1);

        nftService.cancelListing(sellerId, photocardId);

        assertThat(nftService.getPhotocard(photocardId, sellerId).listing()).isNull();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT status::text FROM nft_photocard_listings WHERE id = ?",
                String.class, listing.listingId())).isEqualTo("CANCELLED");
    }

    @Test
    void 판매자_설명_없이_판매를_등록할_수_있다() throws Exception {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicket(sellerId, fixture);
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 1);
        Long photocardId = insertPhotocard(designId, ticketId, sellerId);
        String accessToken = jwtTokenProvider.createAccessToken(sellerId, UserRole.USER);

        mockMvc.perform(post("/photocards/{photocardId}/listing", photocardId)
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType("application/json")
                        .content("{\"price\":3000}"))
                .andExpect(status().isCreated());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT description FROM nft_photocard_listings WHERE photocard_id = ?",
                String.class, photocardId)).isEmpty();
    }

    @Test
    void 구매_정산_완료_전에는_이력과_보유_목록을_변경하지_않는다() {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Long buyerId = insertUser("buyer@test.com", "구매자");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicket(sellerId, fixture);
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 1);
        Long photocardId = insertPhotocard(designId, ticketId, sellerId);
        insertListing(photocardId, sellerId, 3_000L);

        var trade = nftService.purchase(buyerId, photocardId, UUID.randomUUID().toString());

        assertThat(trade.status().name()).isEqualTo("PENDING");
        assertThat(nftService.getPurchaseHistory(buyerId, null, 20).items()).isEmpty();
        assertThat(nftService.getSaleHistory(sellerId, null, 20).items()).isEmpty();
        assertThat(nftService.getMyPhotocards(buyerId, null, null, 20).items())
                .isEmpty();
        var sellerCard = nftService.getMyPhotocards(sellerId, null, null, 20).items().getFirst();
        assertThat(sellerCard.photocardId()).isEqualTo(photocardId);
        assertThat(sellerCard.listed()).isTrue();
        assertThat(sellerCard.marketType().name()).isEqualTo("FIXED_PRICE");
        assertThat(sellerCard.marketStatus().name()).isEqualTo("SETTLING");
        assertThat(nftService.getPhotocard(photocardId, buyerId).listing().status().name())
                .isEqualTo("SETTLING");
    }

    @Test
    void 정산이_완료되면_구매자_보유_목록으로_소유권이_이동한다() {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Long buyerId = insertUser("buyer@test.com", "구매자");
        Fixture fixture = insertPerformanceFixture();
        Long photocardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "소유권 이동 포토카드", 1),
                insertTicket(sellerId, fixture), sellerId);
        insertListing(photocardId, sellerId, 3_000L);

        var trade = nftService.purchase(buyerId, photocardId, UUID.randomUUID().toString());
        settlementWriter.catConfirmed(trade.tradeId());
        settlementWriter.nftSubmitted(trade.tradeId(), null);
        settlementWriter.complete(trade.tradeId());

        assertThat(nftService.getMyPhotocards(buyerId, null, null, 20).items())
                .singleElement()
                .satisfies(card -> {
                    assertThat(card.photocardId()).isEqualTo(photocardId);
                    assertThat(card.listed()).isFalse();
                    assertThat(card.marketType()).isNull();
                    assertThat(card.marketStatus()).isNull();
                });
        assertThat(nftService.getMyPhotocards(sellerId, null, null, 20).items()).isEmpty();
        assertThat(nftService.getPurchaseHistory(buyerId, null, 20).items()).hasSize(1);
        assertThat(nftService.getSaleHistory(sellerId, null, 20).items()).hasSize(1);
    }

    @Test
    void 발급은_티켓당_한_장을_만들고_중복_실행을_차단한다() {
        Long firstUserId = insertUser("first@test.com", "첫째");
        Long secondUserId = insertUser("second@test.com", "둘째");
        Fixture fixture = insertPerformanceFixture();
        insertTicket(firstUserId, fixture);
        insertTicket(secondUserId, fixture);
        Long rareDesignId = insertDesign(fixture.performanceId(), "레어", 1);
        Long normalDesignId = insertDesign(fixture.performanceId(), "노멀", 1);
        NftPhotocardIssueRequest request = new NftPhotocardIssueRequest(List.of(
                new NftDesignAllocationRequest(rareDesignId, 1),
                new NftDesignAllocationRequest(normalDesignId, 1)
        ));

        NftPhotocardIssueResponse response = nftService.issuePhotocards(fixture.performanceId(), request);

        assertThat(response.issuedCount()).isEqualTo(2);
        assertThat(response.failedCount()).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocards", Long.class))
                .isEqualTo(2L);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(DISTINCT ticket_id) FROM nft_photocards", Long.class)).isEqualTo(2L);
        assertNftError(NftErrorCode.PHOTOCARDS_ALREADY_ISSUED,
                () -> nftService.issuePhotocards(fixture.performanceId(), request));
    }

    @Test
    void 마켓_목록의_커서는_중복이나_누락_없이_다음_페이지를_조회한다() {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Fixture fixture = insertPerformanceFixture();
        Long designId = insertDesign(fixture.performanceId(), "검색 가능한 포토카드", 3);
        for (int i = 0; i < 3; i++) {
            Long ticketId = insertTicket(sellerId, fixture);
            Long photocardId = insertPhotocard(designId, ticketId, sellerId);
            insertListing(photocardId, sellerId, 1_000L + i);
        }

        NftCursorPageResponse<NftMarketPhotocardResponse> first = nftService.getMarketPhotocards(
                fixture.performanceId(), "검색 가능", NftMarketSort.RECENT, null, 2);
        NftCursorPageResponse<NftMarketPhotocardResponse> second = nftService.getMarketPhotocards(
                fixture.performanceId(), "검색 가능", NftMarketSort.RECENT, first.nextCursor(), 2);

        assertThat(first.items()).hasSize(2);
        assertThat(first.hasNext()).isTrue();
        assertThat(second.items()).hasSize(1);
        assertThat(second.hasNext()).isFalse();
        Set<Long> ids = new HashSet<>();
        first.items().forEach(item -> ids.add(item.photocardId()));
        second.items().forEach(item -> ids.add(item.photocardId()));
        assertThat(ids).hasSize(3);
    }

    @Test
    void 존재하지_않는_포토카드의_상세_판매_취소_거래내역은_거부한다() {
        assertNftError(NftErrorCode.PHOTOCARD_NOT_FOUND, () -> nftService.getPhotocard(999_999L, 1L));
        assertNftError(NftErrorCode.PHOTOCARD_NOT_FOUND,
                () -> nftService.cancelListing(1L, 999_999L));
        assertNftError(NftErrorCode.PHOTOCARD_NOT_FOUND,
                () -> nftService.getPhotocardTrades(999_999L, 1L, null, 20));
    }

    /**
     * 🔴 <b>ID 만 알면 남의 카드가 열리던 문제.</b>
     *
     * <p>응답에 소유자 닉네임·공연명·좌석이 들어 있고 ID 가 순번이라, 열어두면 1000001 부터
     * 훑어서 "누가 어느 공연 어느 자리에 앉았는지" 를 통째로 긁을 수 있었다.
     */
    @Test
    void 마켓에_없는_카드는_소유자만_볼_수_있다() throws Exception {
        Long ownerId = insertUser("owner@test.com", "소유자");
        Long strangerId = insertUser("stranger@test.com", "타인");
        Fixture fixture = insertPerformanceFixture();
        Long photocardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "비공개 카드", 1),
                insertTicket(ownerId, fixture), ownerId);

        // 소유자는 본다 — 자기 좌석이므로 열·번호까지
        var mine = nftService.getPhotocard(photocardId, ownerId);
        assertThat(mine.isMine()).isTrue();
        mockMvc.perform(get("/photocards/{id}", photocardId)
                        .header("Authorization", "Bearer " + jwtTokenProvider.createAccessToken(ownerId, UserRole.USER)))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.data.isMine").value(true));
        assertThat(mine.origin().rowLabel()).isEqualTo("3");
        assertThat(mine.origin().seatNumber()).isEqualTo(1);

        /* 남과 비로그인은 **존재 여부조차** 모른다. 403 으로 답하면 "그 번호는 있다" 를
           알려주는 셈이라 열거를 도와준다 */
        assertNftError(NftErrorCode.PHOTOCARD_NOT_FOUND,
                () -> nftService.getPhotocard(photocardId, strangerId));
        assertNftError(NftErrorCode.PHOTOCARD_NOT_FOUND,
                () -> nftService.getPhotocard(photocardId, null));
        // 거래 내역도 같은 자물쇠를 쓴다 (판매자·구매자 닉네임이 담긴다)
        assertNftError(NftErrorCode.PHOTOCARD_NOT_FOUND,
                () -> nftService.getPhotocardTrades(photocardId, strangerId, null, 20));
    }

    @Test
    void 판매_중인_카드는_남도_보지만_좌석_열_번호는_가린다() {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Long strangerId = insertUser("stranger@test.com", "타인");
        Fixture fixture = insertPerformanceFixture();
        Long photocardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "판매 카드", 1),
                insertTicket(sellerId, fixture), sellerId);
        nftService.registerListing(sellerId, photocardId,
                new NftListingCreateRequest(3_000L, "설명"));

        var seen = nftService.getPhotocard(photocardId, strangerId);
        assertThat(seen.isMine()).isFalse();
        assertThat(nftService.getPhotocard(photocardId, null).isMine()).isFalse();

        /* 마켓에 올라왔으니 카드 자체는 보여준다 — 구매자가 출처를 확인해야 한다.
           다만 **어느 자리였는지**까지 알려주면 판매 등록이 곧 좌석 공개가 된다.
           등급·구역까지만 남기고 열·번호는 지운다. */
        assertThat(seen.origin().seatGrade()).isEqualTo("VIP");
        assertThat(seen.origin().areaCode()).isEqualTo("A");
        assertThat(seen.origin().rowLabel()).isNull();
        assertThat(seen.origin().seatNumber()).isNull();

        // 주인에게는 그대로 다 보인다
        var owner = nftService.getPhotocard(photocardId, sellerId);
        assertThat(owner.isMine()).isTrue();
        assertThat(owner.origin().rowLabel()).isEqualTo("3");
        assertThat(owner.origin().seatNumber()).isEqualTo(1);
    }

    @Test
    void 소유자가_아니면_판매를_등록할_수_없다() {
        Long ownerId = insertUser("owner@test.com", "소유자");
        Long strangerId = insertUser("stranger@test.com", "타인");
        Fixture fixture = insertPerformanceFixture();
        Long cardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "소유권 검사", 1),
                insertTicket(ownerId, fixture), ownerId);

        assertNftError(NftErrorCode.PHOTOCARD_NOT_OWNED,
                () -> nftService.registerListing(
                        strangerId, cardId, new NftListingCreateRequest(100L, "타인의 카드")));
    }

    @Test
    void 활성_판매가_이미_있으면_중복_등록을_거부한다() {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Fixture fixture = insertPerformanceFixture();
        Long cardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "중복 판매 검사", 1),
                insertTicket(sellerId, fixture), sellerId);
        nftService.registerListing(sellerId, cardId, new NftListingCreateRequest(100L, "첫 등록"));

        assertNftError(NftErrorCode.PHOTOCARD_ALREADY_LISTED,
                () -> nftService.registerListing(
                        sellerId, cardId, new NftListingCreateRequest(200L, "두 번째 등록")));
    }

    @Test
    void 활성_판매가_없거나_판매자가_다르면_취소할_수_없다() {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Long strangerId = insertUser("stranger@test.com", "타인");
        Fixture fixture = insertPerformanceFixture();
        Long cardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "취소 검사", 1),
                insertTicket(sellerId, fixture), sellerId);

        assertNftError(NftErrorCode.LISTING_NOT_FOUND,
                () -> nftService.cancelListing(sellerId, cardId));

        insertListing(cardId, sellerId, 100L);
        assertNftError(NftErrorCode.LISTING_OWNER_MISMATCH,
                () -> nftService.cancelListing(strangerId, cardId));
    }

    @Test
    void 본인_판매는_구매할_수_없다() {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Fixture fixture = insertPerformanceFixture();
        Long cardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "본인 구매 검사", 1),
                insertTicket(sellerId, fixture), sellerId);
        insertListing(cardId, sellerId, 100L);

        assertNftError(NftErrorCode.SELF_PURCHASE_NOT_ALLOWED,
                () -> nftService.purchase(sellerId, cardId, UUID.randomUUID().toString()));
    }

    @Test
    void 판매_이력이_전혀_없으면_구매_시_판매없음으로_응답한다() {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Long buyerId = insertUser("buyer@test.com", "구매자");
        Fixture fixture = insertPerformanceFixture();
        Long cardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "미판매 카드", 1),
                insertTicket(sellerId, fixture), sellerId);

        assertNftError(NftErrorCode.LISTING_NOT_FOUND,
                () -> nftService.purchase(buyerId, cardId, UUID.randomUUID().toString()));
    }

    @Test
    void 취소되거나_판매된_등록은_구매할_수_없다() {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Long buyerId = insertUser("buyer@test.com", "구매자");
        Long otherBuyerId = insertUser("other@test.com", "다른 구매자");
        Fixture fixture = insertPerformanceFixture();
        Long designId = insertDesign(fixture.performanceId(), "종료 판매", 2);
        Long cancelledCardId = insertPhotocard(designId, insertTicket(sellerId, fixture), sellerId);
        insertListing(cancelledCardId, sellerId, 100L);
        nftService.cancelListing(sellerId, cancelledCardId);

        assertNftError(NftErrorCode.LISTING_ALREADY_CLOSED,
                () -> nftService.purchase(buyerId, cancelledCardId, UUID.randomUUID().toString()));

        Long soldCardId = insertPhotocard(designId, insertTicket(sellerId, fixture), sellerId);
        insertListing(soldCardId, sellerId, 200L);
        nftService.purchase(buyerId, soldCardId, UUID.randomUUID().toString());
        assertNftError(NftErrorCode.LISTING_ALREADY_CLOSED,
                () -> nftService.purchase(otherBuyerId, soldCardId, UUID.randomUUID().toString()));
    }

    @Test
    void 멱등키가_없거나_UUID가_아니면_구매를_거부한다() {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Long buyerId = insertUser("buyer@test.com", "구매자");
        Fixture fixture = insertPerformanceFixture();
        Long cardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "멱등키 검사", 1),
                insertTicket(sellerId, fixture), sellerId);
        insertListing(cardId, sellerId, 100L);

        assertNftError(NftErrorCode.INVALID_IDEMPOTENCY_KEY,
                () -> nftService.purchase(buyerId, cardId, null));
        assertNftError(NftErrorCode.INVALID_IDEMPOTENCY_KEY,
                () -> nftService.purchase(buyerId, cardId, "not-a-uuid"));
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocard_trades", Long.class))
                .isZero();
    }

    @Test
    void 같은_구매자가_다른_카드에_멱등키를_재사용하면_거부한다() {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Long buyerId = insertUser("buyer@test.com", "구매자");
        Fixture fixture = insertPerformanceFixture();
        Long designId = insertDesign(fixture.performanceId(), "멱등 대상 검사", 2);
        Long firstCardId = insertPhotocard(designId, insertTicket(sellerId, fixture), sellerId);
        Long secondCardId = insertPhotocard(designId, insertTicket(sellerId, fixture), sellerId);
        insertListing(firstCardId, sellerId, 100L);
        insertListing(secondCardId, sellerId, 200L);
        String key = UUID.randomUUID().toString();

        nftService.purchase(buyerId, firstCardId, key);

        assertNftError(NftErrorCode.IDEMPOTENCY_KEY_REUSED,
                () -> nftService.purchase(buyerId, secondCardId, key));
        assertThat(jdbcTemplate.queryForObject(
                "SELECT owner_id FROM nft_photocards WHERE id = ?", Long.class, secondCardId))
                .isEqualTo(sellerId);
    }

    @Test
    void 잘못된_형식_범위_정렬의_커서를_거부한다() {
        assertNftError(NftErrorCode.INVALID_CURSOR,
                () -> nftService.getMarketPhotocards(null, null, NftMarketSort.RECENT, "%%%", 20));

        NftCursorCodec codec = new NftCursorCodec();
        String otherScope = codec.encode("purchases", "2026-09-03T00:00:00", 1L);
        assertNftError(NftErrorCode.INVALID_CURSOR,
                () -> nftService.getMarketPhotocards(null, null, NftMarketSort.RECENT, otherScope, 20));

        String recentCursor = codec.encode("market:RECENT", "2026-09-03T00:00:00", 1L);
        assertNftError(NftErrorCode.INVALID_CURSOR,
                () -> nftService.getMarketPhotocards(null, null, NftMarketSort.PRICE_ASC, recentCursor, 20));

        String invalidValue = codec.encode("market:PRICE_ASC", "not-a-price", 1L);
        assertNftError(NftErrorCode.INVALID_CURSOR,
                () -> nftService.getMarketPhotocards(null, null, NftMarketSort.PRICE_ASC, invalidValue, 20));
    }

    @Test
    void 페이지_크기는_1부터_100까지만_허용한다() {
        for (Integer invalidSize : List.of(0, -1, 101)) {
            assertNftError(NftErrorCode.INVALID_PAGE_SIZE,
                    () -> nftService.getMarketPhotocards(null, null, null, null, invalidSize));
            assertNftError(NftErrorCode.INVALID_PAGE_SIZE,
                    () -> nftService.getPurchaseHistory(1L, null, invalidSize));
            assertNftError(NftErrorCode.INVALID_PAGE_SIZE,
                    () -> nftService.getSaleHistory(1L, null, invalidSize));
            assertNftError(NftErrorCode.INVALID_PAGE_SIZE,
                    () -> nftService.getMyPhotocards(1L, null, null, invalidSize));
        }
    }

    @Test
    void 존재하지_않는_공연에는_발급할_수_없다() {
        assertNftError(NftErrorCode.PERFORMANCE_NOT_FOUND,
                () -> nftService.issuePhotocards(999_999L,
                        new NftPhotocardIssueRequest(List.of(new NftDesignAllocationRequest(1L, 1)))));
    }

    @Test
    void 존재하지_않는_도안은_발급할_수_없다() {
        Long userId = insertUser("recipient@test.com", "수령자");
        Fixture fixture = insertPerformanceFixture();
        insertTicket(userId, fixture);

        assertNftError(NftErrorCode.DESIGN_NOT_FOUND,
                () -> nftService.issuePhotocards(fixture.performanceId(),
                        new NftPhotocardIssueRequest(List.of(
                                new NftDesignAllocationRequest(999_999L, 1)))));
    }

    @Test
    void 도안_총발행량을_초과하면_발급_전체를_롤백한다() {
        Long firstUserId = insertUser("first@test.com", "첫째");
        Long secondUserId = insertUser("second@test.com", "둘째");
        Fixture fixture = insertPerformanceFixture();
        insertTicket(firstUserId, fixture);
        insertTicket(secondUserId, fixture);
        Long designId = insertDesign(fixture.performanceId(), "한 장 한정", 1);

        assertNftError(NftErrorCode.DESIGN_QUANTITY_EXCEEDED,
                () -> nftService.issuePhotocards(fixture.performanceId(),
                        new NftPhotocardIssueRequest(List.of(
                                new NftDesignAllocationRequest(designId, 2)))));
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocards", Long.class)).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT issued_supply FROM nft_photocard_designs WHERE id = ?", Integer.class, designId))
                .isZero();
    }

    @Test
    void 배정량_합계가_확정티켓_수와_다르면_발급할_수_없다() {
        Long firstUserId = insertUser("first@test.com", "첫째");
        Long secondUserId = insertUser("second@test.com", "둘째");
        Fixture fixture = insertPerformanceFixture();
        insertTicket(firstUserId, fixture);
        insertTicket(secondUserId, fixture);
        Long designId = insertDesign(fixture.performanceId(), "수량 검사", 2);

        assertNftError(NftErrorCode.ALLOCATION_QUANTITY_MISMATCH,
                () -> nftService.issuePhotocards(fixture.performanceId(),
                        new NftPhotocardIssueRequest(List.of(
                                new NftDesignAllocationRequest(designId, 1)))));
    }

    @Test
    void 다른_공연의_도안과_중복_도안_배정은_거부한다() {
        Long userId = insertUser("recipient@test.com", "수령자");
        Fixture target = insertPerformanceFixture();
        Fixture other = insertPerformanceFixture();
        insertTicket(userId, target);
        Long otherDesignId = insertDesign(other.performanceId(), "다른 공연", 1);

        assertNftError(NftErrorCode.DESIGN_PERFORMANCE_MISMATCH,
                () -> nftService.issuePhotocards(target.performanceId(),
                        new NftPhotocardIssueRequest(List.of(
                                new NftDesignAllocationRequest(otherDesignId, 1)))));

        Long targetDesignId = insertDesign(target.performanceId(), "중복 배정", 1);
        assertNftError(NftErrorCode.DUPLICATE_DESIGN_ALLOCATION,
                () -> nftService.issuePhotocards(target.performanceId(),
                        new NftPhotocardIssueRequest(List.of(
                                new NftDesignAllocationRequest(targetDesignId, 1),
                                new NftDesignAllocationRequest(targetDesignId, 1)))));
    }

    @Test
    void 탈퇴한_회원의_티켓이_발급대상에_있으면_전체를_롤백한다() {
        Long activeUserId = insertUser("active@test.com", "활성 회원");
        Long withdrawnUserId = insertUser("withdrawn@test.com", "탈퇴 회원");
        Fixture fixture = insertPerformanceFixture();
        insertTicket(activeUserId, fixture);
        insertTicket(withdrawnUserId, fixture);
        Long designId = insertDesign(fixture.performanceId(), "수령자 검사", 2);
        jdbcTemplate.update("UPDATE users SET deleted_at = now() WHERE id = ?", withdrawnUserId);

        assertNftError(NftErrorCode.PHOTOCARD_OWNER_NOT_FOUND,
                () -> nftService.issuePhotocards(fixture.performanceId(),
                        new NftPhotocardIssueRequest(List.of(
                                new NftDesignAllocationRequest(designId, 2)))));
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocards", Long.class)).isZero();
    }

    @Test
    void 동일_구매자의_동시_재요청은_같은_거래_한_건만_반환한다() throws Exception {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Long buyerId = insertUser("buyer@test.com", "구매자");
        Fixture fixture = insertPerformanceFixture();
        Long cardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "동시 멱등", 1),
                insertTicket(sellerId, fixture), sellerId);
        insertListing(cardId, sellerId, 100L);
        String key = UUID.randomUUID().toString();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(6);
        List<Future<Long>> futures = new ArrayList<>();
        try {
            for (int i = 0; i < 6; i++) {
                futures.add(executor.submit(() -> {
                    start.await();
                    return nftService.purchase(buyerId, cardId, key).tradeId();
                }));
            }
            start.countDown();

            Set<Long> tradeIds = new HashSet<>();
            for (Future<Long> future : futures) {
                tradeIds.add(future.get());
            }
            assertThat(tradeIds).hasSize(1);
            assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocard_trades", Long.class))
                    .isEqualTo(1L);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void 동일_포토카드의_동시_판매등록은_한_건만_성공한다() throws Exception {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Fixture fixture = insertPerformanceFixture();
        Long cardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "동시 판매", 1),
                insertTicket(sellerId, fixture), sellerId);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(6);
        List<Future<Boolean>> futures = new ArrayList<>();
        try {
            for (int i = 0; i < 6; i++) {
                futures.add(executor.submit(() -> {
                    start.await();
                    try {
                        nftService.registerListing(
                                sellerId, cardId, new NftListingCreateRequest(100L, "동시 등록"));
                        return true;
                    } catch (BusinessException e) {
                        assertThat(e.getErrorCode()).isEqualTo(NftErrorCode.PHOTOCARD_ALREADY_LISTED);
                        return false;
                    }
                }));
            }
            start.countDown();

            int successCount = 0;
            for (Future<Boolean> future : futures) {
                if (future.get()) {
                    successCount++;
                }
            }
            assertThat(successCount).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM nft_photocard_listings WHERE status = 'ACTIVE'", Long.class))
                    .isEqualTo(1L);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void 마켓은_공연_검색어_가격순을_정확히_적용하고_와일드카드를_문자로_취급한다() {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Fixture firstPerformance = insertPerformanceFixture();
        Fixture secondPerformance = insertPerformanceFixture();
        Long firstDesignId = insertDesign(firstPerformance.performanceId(), "보라빛 100%", 2);
        Long underscoreDesignId = insertDesign(firstPerformance.performanceId(), "보라빛_A", 1);
        Long otherDesignId = insertDesign(secondPerformance.performanceId(), "보라빛 다른 공연", 1);
        Long firstCardId = insertPhotocard(firstDesignId, insertTicket(sellerId, firstPerformance), sellerId);
        Long secondCardId = insertPhotocard(firstDesignId, insertTicket(sellerId, firstPerformance), sellerId);
        Long underscoreCardId = insertPhotocard(
                underscoreDesignId, insertTicket(sellerId, firstPerformance), sellerId);
        Long otherCardId = insertPhotocard(otherDesignId, insertTicket(sellerId, secondPerformance), sellerId);
        insertListing(firstCardId, sellerId, 300L);
        insertListing(secondCardId, sellerId, 100L);
        insertListing(underscoreCardId, sellerId, 200L);
        insertListing(otherCardId, sellerId, 50L);

        var filtered = nftService.getMarketPhotocards(
                firstPerformance.performanceId(), "보라빛", NftMarketSort.PRICE_ASC, null, 20);
        assertThat(filtered.items()).extracting(NftMarketPhotocardResponse::price)
                .containsExactly(100L, 200L, 300L);

        var percentLiteral = nftService.getMarketPhotocards(
                null, "%", NftMarketSort.RECENT, null, 20);
        assertThat(percentLiteral.items()).extracting(NftMarketPhotocardResponse::photocardId)
                .containsExactlyInAnyOrder(firstCardId, secondCardId);

        var underscoreLiteral = nftService.getMarketPhotocards(
                null, "_", NftMarketSort.RECENT, null, 20);
        assertThat(underscoreLiteral.items()).extracting(NftMarketPhotocardResponse::photocardId)
                .containsExactly(underscoreCardId);
    }

    @Test
    void 내_포토카드는_판매중_여부로_필터링한다() {
        Long ownerId = insertUser("owner@test.com", "소유자");
        Fixture fixture = insertPerformanceFixture();
        Long designId = insertDesign(fixture.performanceId(), "보유 필터", 2);
        Long listedCardId = insertPhotocard(designId, insertTicket(ownerId, fixture), ownerId);
        Long unlistedCardId = insertPhotocard(designId, insertTicket(ownerId, fixture), ownerId);
        insertListing(listedCardId, ownerId, 100L);

        var listed = nftService.getMyPhotocards(ownerId, true, null, 20).items();
        assertThat(listed).extracting(item -> item.photocardId()).containsExactly(listedCardId);
        assertThat(listed.getFirst().marketType().name()).isEqualTo("FIXED_PRICE");
        assertThat(listed.getFirst().marketStatus().name()).isEqualTo("ACTIVE");
        assertThat(nftService.getMyPhotocards(ownerId, false, null, 20).items())
                .extracting(item -> item.photocardId()).containsExactly(unlistedCardId);
    }

    @Test
    void 스탠딩_발행_카드의_상세는_좌석행과_번호가_null이다() {
        Long ownerId = insertUser("owner@test.com", "소유자");
        Fixture fixture = insertStandingPerformanceFixture();
        Long ticketId = insertStandingTicket(ownerId, fixture);
        Long cardId = insertPhotocard(
                insertDesign(fixture.performanceId(), "스탠딩 카드", 1), ticketId, ownerId);

        var detail = nftService.getPhotocard(cardId, ownerId);

        assertThat(detail.origin().seatGrade()).isEqualTo("STANDING");
        assertThat(detail.origin().areaCode()).isEqualTo("S");
        assertThat(detail.origin().rowLabel()).isNull();
        assertThat(detail.origin().seatNumber()).isNull();
    }

    /**
     * ERC-1155 로 가면서 tokenId 가 카드가 아니라 <b>도안</b>이 됐다. 같은 도안 카드 여러 장이
     * 같은 (chain_id, contract_address, token_id) 를 갖는 것이 이제 정상이다 —
     * 예전 UNIQUE 제약은 두 장째 발행을 막았다. (PHOTOCARD_PLAN.md 6-2)
     *
     * <p>세 필드가 함께 채워져야 한다는 CHECK 은 그대로 남는다. 하나만 빠지면 재배포 뒤에
     * "어느 컨트랙트의 몇 번인지" 답할 수 없기 때문이다.
     */
    @Test
    void 체인_식별자는_세_필드가_함께_있어야_하고_같은_도안은_토큰을_공유한다() {
        Long ownerId = insertUser("owner@test.com", "소유자");
        Fixture fixture = insertPerformanceFixture();
        Long designId = insertDesign(fixture.performanceId(), "체인 검사", 3);
        Long firstCardId = insertPhotocard(designId, insertTicket(ownerId, fixture), ownerId);
        Long secondCardId = insertPhotocard(designId, insertTicket(ownerId, fixture), ownerId);
        Long thirdCardId = insertPhotocard(designId, insertTicket(ownerId, fixture), ownerId);
        String address = "0x1111111111111111111111111111111111111111";

        // 셋 중 하나만 채우면 거절한다
        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE nft_photocards SET chain_id = 1 WHERE id = ?", firstCardId))
                .isInstanceOf(DataIntegrityViolationException.class);

        for (Long cardId : List.of(firstCardId, secondCardId, thirdCardId)) {
            jdbcTemplate.update("""
                    UPDATE nft_photocards
                    SET chain_id = 1, contract_address = ?, token_id = ?
                    WHERE id = ?
                    """, address, designId, cardId);
        }

        // 같은 도안 세 장이 같은 토큰을 가리킨다. 예전에는 여기서 UNIQUE 위반이 났다
        assertThat(jdbcTemplate.queryForObject("""
                SELECT count(*) FROM nft_photocards
                 WHERE chain_id = 1 AND contract_address = ? AND token_id = ?
                """, Integer.class, address, designId)).isEqualTo(3);
    }

    @Test
    void 한_티켓에는_포토카드_한_장만_발급되고_활성_판매도_한_건만_존재한다() {
        Long ownerId = insertUser("owner@test.com", "소유자");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicket(ownerId, fixture);
        Long designId = insertDesign(fixture.performanceId(), "고유 제약", 2);
        Long cardId = insertPhotocard(designId, ticketId, ownerId);

        assertThatThrownBy(() -> insertPhotocard(designId, ticketId, ownerId))
                .isInstanceOf(DataIntegrityViolationException.class);

        insertListing(cardId, ownerId, 100L);
        assertThatThrownBy(() -> insertListing(cardId, ownerId, 200L))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 공개_조회는_토큰_없이_접근하고_거래와_발급은_권한을_검사한다() throws Exception {
        Long userId = insertUser("user@test.com", "일반 사용자");
        Long adminId = insertUser("admin@test.com", "관리자", "ADMIN");
        String userToken = jwtTokenProvider.createAccessToken(userId, UserRole.USER);
        String adminToken = jwtTokenProvider.createAccessToken(adminId, UserRole.ADMIN);

        mockMvc.perform(get("/photocards/999999"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/photocards/999999/purchase")
                        .header("Idempotency-Key", UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/photocards/999999/listing"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/admin/performances/999999/photocards/issue")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType("application/json")
                        .content("{\"designAllocations\":[{\"designId\":1,\"quantity\":1}]}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/admin/performances/999999/photocards/issue")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType("application/json")
                        .content("{\"designAllocations\":[{\"designId\":1,\"quantity\":1}]}"))
                .andExpect(status().isNotFound());
    }

    private Long insertStadiumLayout(Long stadiumId) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO stadium_layouts (stadium_id, name, width, height, is_default, status)
                VALUES (?, '기본 배치', 1000, 1000, true, 'ACTIVE') RETURNING id
                """, Long.class, stadiumId);
    }

    // ── 온체인 발행 ────────────────────────────────────────────────

    @Test
    void 발급하면_wallet_id_가_채워지고_체인으로_발행_요청이_나간다() {
        Fixture fixture = insertPerformanceFixture();
        Long userId = insertUser("owner@test.com", "소유자");
        insertTicket(userId, fixture);
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 5);

        NftPhotocardIssueResponse response = photocardIssuer.issue(fixture.performanceId(),
                new NftPhotocardIssueRequest(List.of(new NftDesignAllocationRequest(designId, 1))));

        assertThat(response.issuedCount()).isEqualTo(1);
        assertThat(response.failedCount()).isZero();

        // 발행을 보내려면 받는 주소가 필요하다. 그 주소는 이 지갑에서 나온다
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nft_photocards WHERE wallet_id IS NOT NULL", Integer.class))
                .isEqualTo(1);

        ArgumentCaptor<List<PhotocardChainClient.IssueItem>> sent = ArgumentCaptor.captor();
        verify(photocardChainClient).issuePhotocards(sent.capture());

        List<PhotocardChainClient.IssueItem> items = sent.getValue();
        assertThat(items).hasSize(1);
        // 체인 식별자는 DB PK와 분리하고, 호환용 DB ID도 함께 전달한다.
        assertThat(items.getFirst().photocardKey()).isEqualTo(
                jdbcTemplate.queryForObject("SELECT issue_key FROM nft_photocards", String.class));
        assertThat(items.getFirst().designId()).isEqualTo(jdbcTemplate.queryForObject(
                "SELECT COALESCE(chain_token_id::text, id::text) FROM nft_photocard_designs WHERE id = ?",
                String.class, designId));
        assertThat(items.getFirst().photocardId()).isEqualTo(
                jdbcTemplate.queryForObject("SELECT id::text FROM nft_photocards", String.class));
        assertThat(items.getFirst().designDbId()).isEqualTo(designId.toString());
        assertThat(items.getFirst().to()).isEqualTo("0x" + String.format("%040x", userId));
    }

    @Test
    void 지갑이_없는_회원이_섞이면_발급_전체를_되돌린다() {
        Fixture fixture = insertPerformanceFixture();
        insertTicket(insertUser("has@test.com", "지갑있음"), fixture);
        insertTicket(insertWalletlessUser("none@test.com", "지갑없음", "USER"), fixture);
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 5);

        assertThatThrownBy(() -> photocardIssuer.issue(fixture.performanceId(),
                new NftPhotocardIssueRequest(List.of(new NftDesignAllocationRequest(designId, 2)))))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(NftErrorCode.RECIPIENT_WALLET_NOT_FOUND);

        // 절반만 나간 공연을 수습하는 비용이 발급을 다시 하는 것보다 훨씬 크다
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nft_photocards", Integer.class)).isZero();
        verifyNoInteractions(photocardChainClient);
    }

    @Test
    void 온체인_등록이_안_끝난_도안은_발급을_거절한다() {
        Fixture fixture = insertPerformanceFixture();
        insertTicket(insertUser("owner@test.com", "소유자"), fixture);
        Long designId = insertUnregisteredDesign(fixture.performanceId(), "미등록 도안", 5);

        // 미등록 도안이 하나라도 섞이면 발행 배치 전체가 revert 된다. 보내기 전에 막는다
        assertThatThrownBy(() -> photocardIssuer.issue(fixture.performanceId(),
                new NftPhotocardIssueRequest(List.of(new NftDesignAllocationRequest(designId, 1)))))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(NftErrorCode.DESIGN_NOT_REGISTERED_ON_CHAIN);

        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nft_photocards", Integer.class)).isZero();
        verifyNoInteractions(photocardChainClient);
    }

    @Test
    void 체인_전송이_실패해도_카드는_남고_재시도로_이어_보낸다() {
        Fixture fixture = insertPerformanceFixture();
        insertTicket(insertUser("owner@test.com", "소유자"), fixture);
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 5);

        willThrow(new BusinessException(NftErrorCode.PHOTOCARD_MINT_FAILED))
                .given(photocardChainClient).issuePhotocards(any());

        NftPhotocardIssueResponse issued = photocardIssuer.issue(fixture.performanceId(),
                new NftPhotocardIssueRequest(List.of(new NftDesignAllocationRequest(designId, 1))));

        // 여기서 되돌리면 재발급이 막혀 있어 손쓸 방법이 없어진다
        assertThat(issued.issuedCount()).isEqualTo(1);
        assertThat(issued.failedCount()).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nft_photocards WHERE status = 'PENDING'", Integer.class))
                .isEqualTo(1);

        willReturn(new PhotocardIssueResult("PENDING", "0xabc", 1))
                .given(photocardChainClient).issuePhotocards(any());

        assertThat(photocardIssuer.mintPending(fixture.performanceId()).issuedCount()).isEqualTo(1);
    }

    @Test
    void 이미_보낸_카드는_재시도_대상이_아니다() {
        Fixture fixture = insertPerformanceFixture();
        insertTicket(insertUser("owner@test.com", "소유자"), fixture);
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 5);
        photocardIssuer.issue(fixture.performanceId(),
                new NftPhotocardIssueRequest(List.of(new NftDesignAllocationRequest(designId, 1))));

        // 블록체인 서비스가 요청을 받은 자리에서 MINTING 으로 옮긴다
        jdbcTemplate.update("UPDATE nft_photocards SET status = 'MINTING'");

        // MINTING 은 트랜잭션이 이미 나가 확정을 기다리는 중이라 다시 보내면 안 된다
        assertThatThrownBy(() -> photocardIssuer.mintPending(fixture.performanceId()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(NftErrorCode.NO_PENDING_PHOTOCARDS);
    }

    @Test
    void 한_배치_상한을_넘으면_잘라서_여러_번_보낸다() {
        Fixture fixture = insertPerformanceFixture();
        int total = 201;
        for (int i = 0; i < total; i++) {
            insertTicket(insertUser("owner" + i + "@test.com", "소유자" + i), fixture);
        }
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", total);

        NftPhotocardIssueResponse response = photocardIssuer.issue(fixture.performanceId(),
                new NftPhotocardIssueRequest(List.of(new NftDesignAllocationRequest(designId, total))));

        assertThat(response.issuedCount()).isEqualTo(total);
        assertThat(response.failedCount()).isZero();

        // 컨트랙트의 MAX_BATCH 가 200 이라 넘겨 보내면 400 으로 돌아온다
        ArgumentCaptor<List<PhotocardChainClient.IssueItem>> sent = ArgumentCaptor.captor();
        verify(photocardChainClient, times(2)).issuePhotocards(sent.capture());
        assertThat(sent.getAllValues().get(0)).hasSize(200);
        assertThat(sent.getAllValues().get(1)).hasSize(1);
    }

    // ── 뽑기 풀 도안과의 경계 (B1 · C4 · C3) ────────────────────────────────

    @Test
    void 뽑기_풀_도안_id로_수동_발급을_요청하면_거절되고_카드가_생기지_않는다() {
        // 🔴 B1: 요청 본문의 designId 를 그대로 받는 경로다. 뽑기 풀 도안(그 공연 팩이 뽑을 재고)을
        // 넣으면 티켓 보유자에게 직접(회수 불가로) 민팅되던 결함
        Fixture fixture = insertPerformanceFixture();
        insertTicket(insertUser("b1@test.com", "발급대상"), fixture);
        Long poolDesignId = insertPoolDesign(fixture.performanceId(), "뽑기 풀 도안", 5);

        assertNftError(NftErrorCode.DESIGN_POOL_CONFLICT,
                () -> nftService.issuePhotocards(fixture.performanceId(),
                        new NftPhotocardIssueRequest(
                                List.of(new NftDesignAllocationRequest(poolDesignId, 1)))));

        // 결과 상태를 DB 에서 확인한다 — 카드가 한 장도 만들어지지 않았어야 한다
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocards", Long.class)).isZero();
    }

    @Test
    void 이벤트_풀_도안_id로_수동_발급을_요청해도_NPE_없이_거절된다() {
        // 🔴 B1: 이벤트 풀 도안은 performanceId 가 NULL 이라, isDrawPool() 검사보다
        // getPerformanceId().equals(performanceId) 가 먼저면 NPE(500)가 난다
        Fixture fixture = insertPerformanceFixture();
        insertTicket(insertUser("b1b@test.com", "발급대상"), fixture);
        Long eventPoolDesignId = insertPoolDesign(null, "이벤트 풀 도안", 5);

        assertNftError(NftErrorCode.DESIGN_POOL_CONFLICT,
                () -> nftService.issuePhotocards(fixture.performanceId(),
                        new NftPhotocardIssueRequest(
                                List.of(new NftDesignAllocationRequest(eventPoolDesignId, 1)))));

        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocards", Long.class)).isZero();
    }

    @Test
    void 공연_팩에서_카드가_한_번_뽑힌_뒤에도_수동_발급은_여전히_가능하다() {
        // 🔴 C4: existsByDesignPerformanceId(전체) 는 뽑힌 카드(ticket_id NULL)도 세어, 그 공연
        // 팩을 한 번만 열어도 수동 일괄 발급이 영구히 막혔다
        Fixture fixture = insertPerformanceFixture();
        Long poolDesignId = insertPoolDesign(fixture.performanceId(), "뽑기 풀 도안", 5);
        insertDrawnPhotocard(poolDesignId, insertUser("drawer@test.com", "뽑은사람"));

        Long recipientId = insertUser("c4@test.com", "발급대상");
        insertTicket(recipientId, fixture);
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 1);

        NftPhotocardIssueResponse response = nftService.issuePhotocards(fixture.performanceId(),
                new NftPhotocardIssueRequest(List.of(new NftDesignAllocationRequest(designId, 1))));

        // 결과 상태를 DB 에서 확인한다 — 뽑힌 카드 1장 + 이번에 발급된 티켓 카드 1장
        assertThat(response.issuedCount()).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocards", Long.class))
                .isEqualTo(2L);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nft_photocards WHERE ticket_id IS NOT NULL", Long.class))
                .isEqualTo(1L);
    }

    @Test
    void 뽑은_카드는_발행_재시도_조회에_잡히지_않는다() {
        // 🔴 C3: findPendingMints 가 d.performance_general_id 로만 걸러서, 그 공연 팩에서 뽑힌
        // 카드(티켓 NULL)까지 발행 재시도 대상에 들어가 수동 발행 재시도와 뽑기 스위퍼가 같은
        // 카드를 동시에 보내는 중복 트랜잭션이 생겼었다
        Fixture fixture = insertPerformanceFixture();
        Long recipientId = insertUser("recipient@test.com", "수령자");
        insertTicket(recipientId, fixture);
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 1);
        nftService.issuePhotocards(fixture.performanceId(),
                new NftPhotocardIssueRequest(List.of(new NftDesignAllocationRequest(designId, 1))));

        Long poolDesignId = insertPoolDesign(fixture.performanceId(), "뽑기 풀 도안", 5);
        insertDrawnPhotocard(poolDesignId, insertUser("drawer2@test.com", "뽑은사람2"));

        List<NftMarketQueryRepository.PendingMintRow> pending =
                nftMarketQueryRepository.findPendingMints(fixture.performanceId(), 100);

        // 티켓 기반 카드만 나와야 한다 — 뽑힌 카드(poolDesignId)는 결과에 없어야 한다
        assertThat(pending).extracting(NftMarketQueryRepository.PendingMintRow::designId)
                .containsExactly(designId)
                .doesNotContain(poolDesignId);
    }

    // ── 회차(performance_detail) 단위 자동 발급 ────────────────────────────────

    @Test
    void 회차_자동발급은_그_회차의_티켓에만_카드를_만든다() {
        Fixture fixture = insertPerformanceFixture();
        Long scheduleA = fixture.performanceDetailId();
        Long scheduleB = insertSchedule(fixture.performanceId(), 2, "now() + interval '2 hours'");
        Long ticketA = insertTicketOnSchedule(insertUser("a@test.com", "가"), scheduleA, fixture.areaId());
        Long ticketB = insertTicketOnSchedule(insertUser("b@test.com", "나"), scheduleB, fixture.areaId());
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 10);

        NftPhotocardIssueResponse response = photocardIssuer.issueForSchedule(scheduleA);

        assertThat(response.issuedCount()).isEqualTo(1);
        assertThat(response.failedCount()).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT ticket_id FROM nft_photocards", Long.class)).isEqualTo(ticketA);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nft_photocards WHERE ticket_id = ?", Long.class, ticketB)).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT issued_supply FROM nft_photocard_designs WHERE id = ?", Integer.class, designId))
                .isEqualTo(1);
        verify(photocardChainClient, times(1)).issuePhotocards(any());
    }

    @Test
    void 이미_발급된_회차를_다시_부르면_카드를_더_만들지_않는다() {
        Fixture fixture = insertPerformanceFixture();
        insertTicketOnSchedule(insertUser("a@test.com", "가"), fixture.performanceDetailId(), fixture.areaId());
        insertDesign(fixture.performanceId(), "한정 포토카드", 10);

        assertThat(photocardIssuer.issueForSchedule(fixture.performanceDetailId()).issuedCount()).isEqualTo(1);
        // 블록체인 서비스가 요청을 받은 자리에서 MINTING 으로 옮긴다
        jdbcTemplate.update("UPDATE nft_photocards SET status = 'MINTING'");

        assertThat(photocardIssuer.issueForSchedule(fixture.performanceDetailId()).issuedCount()).isZero();

        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocards", Long.class)).isEqualTo(1L);
        // 첫 발급 때 한 번만 나갔다. 두 번째 호출은 새 카드도, 새 전송도 만들지 않는다
        verify(photocardChainClient, times(1)).issuePhotocards(any());
    }

    @Test
    void 회차_자동발급은_지갑_없는_수령자를_건너뛰고_나머지로_발급한다() {
        Fixture fixture = insertPerformanceFixture();
        Long withWallet = insertTicketOnSchedule(
                insertUser("has@test.com", "지갑있음"), fixture.performanceDetailId(), fixture.areaId());
        Long noWallet = insertTicketOnSchedule(
                insertWalletlessUser("none@test.com", "지갑없음", "USER"),
                fixture.performanceDetailId(), fixture.areaId());
        insertDesign(fixture.performanceId(), "한정 포토카드", 10);

        NftPhotocardIssueResponse response = photocardIssuer.issueForSchedule(fixture.performanceDetailId());

        assertThat(response.issuedCount()).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT ticket_id FROM nft_photocards", Long.class)).isEqualTo(withWallet);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nft_photocards WHERE ticket_id = ?", Long.class, noWallet)).isZero();
    }

    @Test
    void 회차_자동발급은_온체인_미등록_도안만_있으면_발급하지_않는다() {
        Fixture fixture = insertPerformanceFixture();
        insertTicketOnSchedule(insertUser("a@test.com", "가"), fixture.performanceDetailId(), fixture.areaId());
        insertUnregisteredDesign(fixture.performanceId(), "미등록 도안", 10);

        NftPhotocardIssueResponse response = photocardIssuer.issueForSchedule(fixture.performanceDetailId());

        assertThat(response.issuedCount()).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocards", Long.class)).isZero();
        verifyNoInteractions(photocardChainClient);
    }

    @Test
    void 회차_자동발급은_도안_재고가_수령자보다_적으면_재고만큼만_발급한다() {
        Fixture fixture = insertPerformanceFixture();
        for (int i = 0; i < 3; i++) {
            insertTicketOnSchedule(insertUser("u" + i + "@test.com", "수령자" + i),
                    fixture.performanceDetailId(), fixture.areaId());
        }
        Long designId = insertDesign(fixture.performanceId(), "재고 2장", 2);

        NftPhotocardIssueResponse response = photocardIssuer.issueForSchedule(fixture.performanceDetailId());

        assertThat(response.issuedCount()).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocards", Long.class)).isEqualTo(2L);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT issued_supply FROM nft_photocard_designs WHERE id = ?", Integer.class, designId))
                .isEqualTo(2);
    }

    @Test
    void 스케줄러는_시작_1시간_이내_회차만_발급하고_지난_회차와_먼_회차는_건드리지_않는다() {
        Fixture fixture = insertPerformanceFixture();
        Long dueSoon = insertSchedule(fixture.performanceId(), 2, "now() + interval '30 minutes'");
        Long farOff = insertSchedule(fixture.performanceId(), 3, "now() + interval '5 hours'");
        Long past = insertSchedule(fixture.performanceId(), 4, "now() - interval '10 minutes'");
        Long dueTicket = insertTicketOnSchedule(insertUser("due@test.com", "임박"), dueSoon, fixture.areaId());
        insertTicketOnSchedule(insertUser("far@test.com", "먼회차"), farOff, fixture.areaId());
        insertTicketOnSchedule(insertUser("past@test.com", "지난회차"), past, fixture.areaId());
        insertDesign(fixture.performanceId(), "한정 포토카드", 50);

        // 발급 전: 임박 회차만 대상이다 (지난 회차·먼 회차·과거 fixture 회차는 빠진다)
        assertThat(nftMarketQueryRepository.findScheduleIdsDueForIssue(
                java.time.LocalDateTime.now(), java.time.LocalDateTime.now().plusHours(1), 20))
                .containsExactly(dueSoon);

        photocardIssueScheduler.issueDuePhotocards();

        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_photocards", Long.class)).isEqualTo(1L);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT ticket_id FROM nft_photocards", Long.class)).isEqualTo(dueTicket);
        // 발급 뒤: 임박 회차의 확정 티켓이 전부 카드를 받아 더는 대상이 아니다
        assertThat(nftMarketQueryRepository.findScheduleIdsDueForIssue(
                java.time.LocalDateTime.now(), java.time.LocalDateTime.now().plusHours(1), 20))
                .isEmpty();
    }

    private Long insertSchedule(Long performanceId, int performanceNum, String performanceDateSql) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO performance_details
                    (performance_general_id, performance_num, performance_date, status)
                VALUES (?, ?, %s, 'SCHEDULED') RETURNING id
                """.formatted(performanceDateSql), Long.class, performanceId, performanceNum);
    }

    private Long insertTicketOnSchedule(Long userId, Long scheduleId, Long areaId) {
        Long faceId = insertFace();
        Integer seatNumber = jdbcTemplate.queryForObject(
                "SELECT count(*)::int + 1 FROM seats WHERE area_id = ?", Integer.class, areaId);
        Long seatId = jdbcTemplate.queryForObject("""
                INSERT INTO seats (area_id, row_label, seat_number)
                VALUES (?, '3', ?) RETURNING id
                """, Long.class, areaId, seatNumber);
        return jdbcTemplate.queryForObject("""
                INSERT INTO tickets (user_id, performance_detail_id, area_id, seat_id, status, face_embedding, face_model_version)
                VALUES (?, ?, ?, ?, 'CONFIRMED', (SELECT embedding FROM faces WHERE id = ?), 'test-model') RETURNING id
                """, Long.class, userId, scheduleId, areaId, seatId, faceId);
    }

    private Long insertUser(String email, String nickname) {
        return insertUser(email, nickname, "USER");
    }

    /** 지갑까지 갖춘 회원. 발급 대상 전원에게 지갑이 있어야 하므로 이게 기본이다 */
    private Long insertUser(String email, String nickname, String role) {
        Long userId = insertWalletlessUser(email, nickname, role);
        insertWallet(userId);
        return userId;
    }

    /** 지갑 없는 회원. "한 명이라도 지갑이 없으면 전체 롤백" 을 확인할 때만 쓴다 */
    private Long insertWalletlessUser(String email, String nickname, String role) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO users (email, password, name, nickname, phone, role)
                VALUES (?, 'encoded-password', '테스트 사용자', ?, '010-0000-0000', ?::user_role)
                RETURNING id
                """, Long.class, email, nickname, role);
    }

    private void insertWallet(Long userId) {
        String address = "0x" + String.format("%040x", userId);
        Long ownerId = jdbcTemplate.queryForObject("""
                INSERT INTO wallet_owners (user_id, derivation_index, owner_address, key_version)
                VALUES (?, ?, ?, 1) RETURNING id
                """, Long.class, userId, userId.intValue(), address);
        jdbcTemplate.update("""
                INSERT INTO wallets (owner_id, chain_id, type, address, status)
                VALUES (?, ?, 'RELAYER_EOA', ?, 'ACTIVE')
                """, ownerId, blockchainProperties.chainId(), address);
    }

    private Fixture insertPerformanceFixture() {
        Long stadiumId = jdbcTemplate.queryForObject("""
                INSERT INTO stadiums (name, address, max_capacity)
                VALUES ('테스트 공연장', '서울', 100000) RETURNING id
                """, Long.class);
        Long layoutId = insertStadiumLayout(stadiumId);
        Long areaId = jdbcTemplate.queryForObject("""
                INSERT INTO areas (stadium_id, stadium_layout_id, area_code, type, max_seat)
                VALUES (?, ?, 'A', 'SEATED', 1000) RETURNING id
                """, Long.class, stadiumId, layoutId);
        Long performanceId = jdbcTemplate.queryForObject("""
                INSERT INTO performance_general
                    (stadium_id, stadium_layout_id, visible_from, title, ticketing_start_at, status)
                VALUES (?, ?, CURRENT_DATE, '테스트 공연', now(), 'UPCOMING') RETURNING id
                """, Long.class, stadiumId, layoutId);
        Long performanceDetailId = jdbcTemplate.queryForObject("""
                INSERT INTO performance_details
                    (performance_general_id, performance_num, performance_date, status)
                VALUES (?, 1, CURRENT_DATE, 'SCHEDULED') RETURNING id
                """, Long.class, performanceId);
        jdbcTemplate.update("""
                INSERT INTO performance_areas
                    (performance_general_id, area_id, grade, price, max_cnt)
                VALUES (?, ?, 'VIP', 100000, 1000)
                """, performanceId, areaId);
        return new Fixture(performanceId, performanceDetailId, areaId);
    }

    private Fixture insertStandingPerformanceFixture() {
        Long stadiumId = jdbcTemplate.queryForObject("""
                INSERT INTO stadiums (name, address, max_capacity)
                VALUES ('스탠딩 공연장', '서울', 100000) RETURNING id
                """, Long.class);
        Long layoutId = insertStadiumLayout(stadiumId);
        Long areaId = jdbcTemplate.queryForObject("""
                INSERT INTO areas (stadium_id, stadium_layout_id, area_code, type, max_seat)
                VALUES (?, ?, 'S', 'STANDING', 1000) RETURNING id
                """, Long.class, stadiumId, layoutId);
        Long performanceId = jdbcTemplate.queryForObject("""
                INSERT INTO performance_general
                    (stadium_id, stadium_layout_id, visible_from, title, ticketing_start_at, status)
                VALUES (?, ?, CURRENT_DATE, '스탠딩 공연', now(), 'UPCOMING') RETURNING id
                """, Long.class, stadiumId, layoutId);
        Long performanceDetailId = jdbcTemplate.queryForObject("""
                INSERT INTO performance_details
                    (performance_general_id, performance_num, performance_date, status)
                VALUES (?, 1, CURRENT_DATE, 'SCHEDULED') RETURNING id
                """, Long.class, performanceId);
        jdbcTemplate.update("""
                INSERT INTO performance_areas
                    (performance_general_id, area_id, grade, price, max_cnt)
                VALUES (?, ?, 'STANDING', 50000, 1000)
                """, performanceId, areaId);
        return new Fixture(performanceId, performanceDetailId, areaId);
    }

    private Long insertTicket(Long userId, Fixture fixture) {
        Long faceId = insertFace();
        Integer seatNumber = jdbcTemplate.queryForObject(
                "SELECT count(*)::int + 1 FROM seats WHERE area_id = ?", Integer.class, fixture.areaId());
        Long seatId = jdbcTemplate.queryForObject("""
                INSERT INTO seats (area_id, row_label, seat_number)
                VALUES (?, '3', ?) RETURNING id
                """, Long.class, fixture.areaId(), seatNumber);
        return jdbcTemplate.queryForObject("""
                INSERT INTO tickets (user_id, performance_detail_id, area_id, seat_id, status, face_embedding, face_model_version)
                VALUES (?, ?, ?, ?, 'CONFIRMED', (SELECT embedding FROM faces WHERE id = ?), 'test-model') RETURNING id
                """, Long.class, userId, fixture.performanceDetailId(), fixture.areaId(), seatId, faceId);
    }

    private Long insertStandingTicket(Long userId, Fixture fixture) {
        Long faceId = insertFace();
        return jdbcTemplate.queryForObject("""
                INSERT INTO tickets (user_id, performance_detail_id, area_id, seat_id, status, face_embedding, face_model_version)
                VALUES (?, ?, ?, NULL, 'CONFIRMED', (SELECT embedding FROM faces WHERE id = ?), 'test-model') RETURNING id
                """, Long.class, userId, fixture.performanceDetailId(), fixture.areaId(), faceId);
    }

    /** 티켓에 베껴 넣을 얼굴을 하나 만든다 (tickets 는 이제 faces 를 가리키지 않고 값을 복사한다) */
    private Long insertFace() {
        String zeros = "[" + "0,".repeat(127) + "0]";
        return jdbcTemplate.queryForObject("""
                INSERT INTO faces (embedding, model_version) VALUES (?::vector, 'test') RETURNING id
                """, Long.class, zeros);
    }

    /**
     * 발급의 전제가 "도안이 온체인에 등록돼 있을 것" 이라 REGISTERED 로 만든다.
     * 미등록 도안을 확인하는 테스트는 {@link #insertUnregisteredDesign} 을 쓴다.
     */
    private Long insertDesign(Long performanceId, String name, int totalSupply) {
        Long designId = insertUnregisteredDesign(performanceId, name, totalSupply);
        jdbcTemplate.update("""
                UPDATE nft_photocard_designs
                SET chain_status = 'REGISTERED', image_cid = 'bafyIMG', metadata_cid = 'bafyMETA',
                    registered_at = now()
                WHERE id = ?
                """, designId);
        return designId;
    }

    private Long insertUnregisteredDesign(Long performanceId, String name, int totalSupply) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO nft_photocard_designs
                    (performance_general_id, name, image_url, total_supply)
                VALUES (?, ?, '/test.png', ?) RETURNING id
                """, Long.class, performanceId, name, totalSupply);
    }

    /** 뽑기 풀 도안(draw_pool = true) 한 행. performanceId 가 null 이면 이벤트 풀 도안 */
    private Long insertPoolDesign(Long performanceId, String name, int totalSupply) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO nft_photocard_designs
                    (performance_general_id, name, image_url, total_supply, image_cid, metadata_cid,
                     chain_status, draw_pool, group_name, grade)
                VALUES (?, ?, '/draw.png', ?, 'bafyIMG', 'bafyMETA',
                        'REGISTERED', true, '서울 5반', 'SPECIAL'::nft_photocard_grade)
                RETURNING id
                """, Long.class, performanceId, name, totalSupply);
    }

    private Long insertPhotocard(Long designId, Long ticketId, Long ownerId) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO nft_photocards (design_id, ticket_id, owner_id, status)
                VALUES (?, ?, ?, 'MINTED') RETURNING id
                """, Long.class, designId, ticketId, ownerId);
    }

    @Test
    void 조회순은_세션별_중복을_제거하고_커서에서도_누락되지_않는다() {
        Long sellerId = insertUser("view-seller@test.com", "조회 판매자");
        Fixture fixture = insertPerformanceFixture();
        Long designId = insertDesign(fixture.performanceId(), "조회 포카", 2);
        Long firstCardId = insertPhotocard(designId, insertTicket(sellerId, fixture), sellerId);
        Long secondCardId = insertPhotocard(designId, insertTicket(sellerId, fixture), sellerId);
        insertListing(firstCardId, sellerId, 100L);
        insertListing(secondCardId, sellerId, 200L);

        String firstSession = UUID.randomUUID().toString();
        assertThat(nftService.recordPhotocardView(firstCardId, null, firstSession).counted()).isTrue();
        assertThat(nftService.recordPhotocardView(firstCardId, null, firstSession).counted()).isFalse();
        nftService.recordPhotocardView(secondCardId, null, UUID.randomUUID().toString());
        nftService.recordPhotocardView(secondCardId, null, UUID.randomUUID().toString());

        var firstPage = nftService.getMarketPhotocards(null, null, NftMarketSort.VIEW_DESC, null, 1);
        var secondPage = nftService.getMarketPhotocards(
                null, null, NftMarketSort.VIEW_DESC, firstPage.nextCursor(), 1);

        assertThat(firstPage.items()).extracting(NftMarketPhotocardResponse::photocardId)
                .containsExactly(secondCardId);
        assertThat(firstPage.items().getFirst().viewCount()).isEqualTo(2L);
        assertThat(secondPage.items()).extracting(NftMarketPhotocardResponse::photocardId)
                .containsExactly(firstCardId);
        assertThat(secondPage.items().getFirst().viewCount()).isEqualTo(1L);
    }

    @Test
    void 발행이_끝나지_않은_포카는_판매할_수_없다() {
        Long sellerId = insertUser("pending-seller@test.com", "발행 대기 판매자");
        Fixture fixture = insertPerformanceFixture();
        Long pendingCardId = jdbcTemplate.queryForObject("""
                INSERT INTO nft_photocards (design_id, ticket_id, owner_id, status)
                VALUES (?, ?, ?, 'PENDING') RETURNING id
                """, Long.class,
                insertDesign(fixture.performanceId(), "발행 대기 포카", 1),
                insertTicket(sellerId, fixture), sellerId);

        assertNftError(NftErrorCode.PHOTOCARD_NOT_MINTED,
                () -> nftService.registerListing(sellerId, pendingCardId,
                        new NftListingCreateRequest(100L, "아직 판매 불가")));
    }

    @Test
    void 인기_공연은_최근_조회_활동으로_순위를_계산한다() {
        Fixture first = insertPerformanceFixture();
        Fixture second = insertPerformanceFixture();
        performanceService.recordView(first.performanceId(), UUID.randomUUID().toString());
        performanceService.recordView(second.performanceId(), UUID.randomUUID().toString());
        performanceService.recordView(second.performanceId(), UUID.randomUUID().toString());

        var ranking = rankingService.popularConcerts();

        assertThat(ranking).extracting(item -> item.concertId())
                .containsExactly(second.performanceId(), first.performanceId());
        assertThat(ranking).extracting(item -> item.score()).containsExactly(2L, 1L);
    }

    @Test
    void 실시간_검색어는_이전_시간_순위와_비교해_변동을_계산한다() {
        LocalDateTime current = LocalDateTime.now().withMinute(0).withSecond(0).withNano(0).minusHours(1);
        searchTrendRepository.replace(current.minusHours(1), List.of(
                new SearchTrendRepository.Snapshot(1, "alpha", "Alpha", 10),
                new SearchTrendRepository.Snapshot(2, "beta", "Beta", 8)));
        searchTrendRepository.replace(current, List.of(
                new SearchTrendRepository.Snapshot(1, "beta", "Beta", 12),
                new SearchTrendRepository.Snapshot(2, "gamma", "Gamma", 7)));

        var trends = searchService.trends();

        assertThat(trends.items()).extracting(item -> item.keyword()).containsExactly("Beta", "Gamma");
        assertThat(trends.items()).extracting(item -> item.trend()).containsExactly("UP", "NEW");
    }

    /** 카드팩에서 뽑힌 카드처럼 ticket_id 없이 카드 행을 만든다. ownerId 는 지갑까지 갖춘 회원이어야 한다 */
    private Long insertDrawnPhotocard(Long designId, Long ownerId) {
        Long walletId = jdbcTemplate.queryForObject("""
                SELECT w.id FROM wallets w JOIN wallet_owners o ON o.id = w.owner_id WHERE o.user_id = ?
                """, Long.class, ownerId);
        return jdbcTemplate.queryForObject("""
                INSERT INTO nft_photocards (design_id, ticket_id, owner_id, wallet_id, status)
                VALUES (?, NULL, ?, ?, 'PENDING') RETURNING id
                """, Long.class, designId, ownerId, walletId);
    }

    private void insertListing(Long photocardId, Long sellerId, Long price) {
        jdbcTemplate.update("""
                INSERT INTO nft_photocard_listings
                    (photocard_id, seller_id, price, description, status)
                VALUES (?, ?, ?, '테스트 판매 설명', 'ACTIVE')
                """, photocardId, sellerId, price);
    }

    private void assertNftError(NftErrorCode expected, org.assertj.core.api.ThrowableAssert.ThrowingCallable action) {
        assertThatThrownBy(action)
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).getErrorCode()).isEqualTo(expected));
    }

    @Test
    void 내_포토카드_요약은_도안별_보유_수와_판매_상태를_한_번에_준다() {
        Long userId = insertUser("summary@test.com", "요약");
        Long sellerCounterpart = insertUser("other@test.com", "남");
        Fixture fixture = insertPerformanceFixture();
        Long designId = insertDesign(fixture.performanceId(), "세 장짜리 도안", 10);
        Long otherDesignId = insertDesign(fixture.performanceId(), "한 장짜리 도안", 10);

        // 오래된 순: 보관 → 고정가 → 고정가(가장 최근). 카드마다 티켓이 따로 필요하다
        Long stored = insertPhotocard(designId, insertTicket(userId, fixture), userId);
        Long listedOld = insertPhotocard(designId, insertTicket(userId, fixture), userId);
        Long listedNew = insertPhotocard(designId, insertTicket(userId, fixture), userId);
        Long pending = insertPhotocard(otherDesignId, insertTicket(userId, fixture), userId);
        // 남의 카드는 세지 않는다
        insertPhotocard(designId, insertTicket(sellerCounterpart, fixture), sellerCounterpart);

        // 이 클래스의 insertPhotocard 는 MINTED 로 넣는다. 발행 중인 카드 하나만 PENDING 으로 되돌린다
        jdbcTemplate.update("UPDATE nft_photocards SET status = 'PENDING' WHERE id = ?", pending);
        insertListing(listedOld, userId, 3_000L);
        insertListing(listedNew, userId, 4_000L);

        var summary = nftService.getMyPhotocardSummary(userId);

        assertThat(summary.designs()).hasSize(2);
        var three = summary.designs().stream()
                .filter(d -> d.designId().equals(designId)).findFirst().orElseThrow();
        assertThat(three.count()).isEqualTo(3);
        // count 에서 빼지 않는다 — 마켓에 올려도 팔리기 전까지 내 것이다
        assertThat(three.marketCount()).isEqualTo(2);
        assertThat(three.marketState().name()).isEqualTo("LISTED");
        // 🔴 대표는 보관 중인 카드다. 판매 중인 카드 상세로 떨어지면 남은 카드를 보러 온 사람에게 막힌 길이다
        assertThat(three.photocardId()).isEqualTo(stored);

        var one = summary.designs().stream()
                .filter(d -> d.designId().equals(otherDesignId)).findFirst().orElseThrow();
        assertThat(one.count()).isEqualTo(1);
        assertThat(one.marketCount()).isZero();
        assertThat(one.marketState()).isNull();
        assertThat(one.photocardId()).isEqualTo(pending);

        // 발행 중인 카드가 하나 있으므로 화면이 다시 물어볼 이유가 있다
        assertThat(summary.pendingCount()).isEqualTo(1);
    }

    @Test
    void 카드가_없으면_요약은_비어_있고_다시_물어볼_이유도_없다() {
        Long userId = insertUser("empty-summary@test.com", "빈요약");

        var summary = nftService.getMyPhotocardSummary(userId);

        assertThat(summary.designs()).isEmpty();
        assertThat(summary.pendingCount()).isZero();
    }

    private record Fixture(Long performanceId, Long performanceDetailId, Long areaId) {
    }
}
