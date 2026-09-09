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
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
    }

    @Autowired
    private NftService nftService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private org.springframework.test.web.servlet.MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("TRUNCATE TABLE users, faces, stadiums RESTART IDENTITY CASCADE");
    }

    @Test
    void 동시에_구매해도_한_명만_소유권을_얻는다() throws Exception {
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
                    Long.class, photocardId)).isEqualTo(winners.getFirst());
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT status::text FROM nft_photocard_listings WHERE photocard_id = ?",
                    String.class, photocardId)).isEqualTo("SOLD");
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
        var detail = nftService.getPhotocard(photocardId);
        assertThat(detail.listing()).isNotNull();
        assertThat(detail.listing().sellerDescription()).isEqualTo("스크래치 없는 카드입니다.");
        assertThat(detail.issuedAt()).isNotNull();
        assertThat(detail.origin().seatGrade()).isEqualTo("VIP");
        assertThat(detail.origin().areaCode()).isEqualTo("A");
        assertThat(detail.origin().rowLabel()).isEqualTo("3");
        assertThat(detail.origin().seatNumber()).isEqualTo(1);

        nftService.cancelListing(sellerId, photocardId);

        assertThat(nftService.getPhotocard(photocardId).listing()).isNull();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT status::text FROM nft_photocard_listings WHERE id = ?",
                String.class, listing.listingId())).isEqualTo("CANCELLED");
    }

    @Test
    void 구매_후_구매자_판매자_카드별_내역과_보유_목록에_반영된다() {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Long buyerId = insertUser("buyer@test.com", "구매자");
        Fixture fixture = insertPerformanceFixture();
        Long ticketId = insertTicket(sellerId, fixture);
        Long designId = insertDesign(fixture.performanceId(), "한정 포토카드", 1);
        Long photocardId = insertPhotocard(designId, ticketId, sellerId);
        insertListing(photocardId, sellerId, 3_000L);

        nftService.purchase(buyerId, photocardId, UUID.randomUUID().toString());

        assertThat(nftService.getPurchaseHistory(buyerId, null, 20).items()).hasSize(1);
        assertThat(nftService.getSaleHistory(sellerId, null, 20).items()).hasSize(1);
        assertThat(nftService.getPhotocardTrades(photocardId, null, 20).items()).hasSize(1);
        assertThat(nftService.getMyPhotocards(buyerId, null, null, 20).items())
                .extracting(item -> item.photocardId())
                .containsExactly(photocardId);
        assertThat(nftService.getMyPhotocards(sellerId, null, null, 20).items()).isEmpty();
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
        assertNftError(NftErrorCode.PHOTOCARD_NOT_FOUND, () -> nftService.getPhotocard(999_999L));
        assertNftError(NftErrorCode.PHOTOCARD_NOT_FOUND,
                () -> nftService.cancelListing(1L, 999_999L));
        assertNftError(NftErrorCode.PHOTOCARD_NOT_FOUND,
                () -> nftService.getPhotocardTrades(999_999L, null, 20));
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

        assertThat(nftService.getMyPhotocards(ownerId, true, null, 20).items())
                .extracting(item -> item.photocardId()).containsExactly(listedCardId);
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

        var detail = nftService.getPhotocard(cardId);

        assertThat(detail.origin().seatGrade()).isEqualTo("STANDING");
        assertThat(detail.origin().areaCode()).isEqualTo("S");
        assertThat(detail.origin().rowLabel()).isNull();
        assertThat(detail.origin().seatNumber()).isNull();
    }

    @Test
    void 체인_식별자는_세_필드가_함께_있어야_하고_체인별로_토큰을_구분한다() {
        Long ownerId = insertUser("owner@test.com", "소유자");
        Fixture fixture = insertPerformanceFixture();
        Long designId = insertDesign(fixture.performanceId(), "체인 검사", 3);
        Long firstCardId = insertPhotocard(designId, insertTicket(ownerId, fixture), ownerId);
        Long secondCardId = insertPhotocard(designId, insertTicket(ownerId, fixture), ownerId);
        Long thirdCardId = insertPhotocard(designId, insertTicket(ownerId, fixture), ownerId);
        String address = "0x1111111111111111111111111111111111111111";

        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE nft_photocards SET chain_id = 1 WHERE id = ?", firstCardId))
                .isInstanceOf(DataIntegrityViolationException.class);

        jdbcTemplate.update("""
                UPDATE nft_photocards
                SET chain_id = 1, contract_address = ?, token_id = 7, metadata_uri = 'ipfs://metadata/7'
                WHERE id = ?
                """, address, firstCardId);
        jdbcTemplate.update("""
                UPDATE nft_photocards
                SET chain_id = 2, contract_address = ?, token_id = 7
                WHERE id = ?
                """, address, secondCardId);
        assertThatThrownBy(() -> jdbcTemplate.update("""
                UPDATE nft_photocards
                SET chain_id = 1, contract_address = ?, token_id = 7
                WHERE id = ?
                """, address, thirdCardId)).isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT metadata_uri FROM nft_photocards WHERE id = ?", String.class, firstCardId))
                .isEqualTo("ipfs://metadata/7");
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

    private Long insertUser(String email, String nickname) {
        return insertUser(email, nickname, "USER");
    }

    private Long insertUser(String email, String nickname, String role) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO users (email, password, name, nickname, phone, role)
                VALUES (?, 'encoded-password', '테스트 사용자', ?, '010-0000-0000', ?::user_role)
                RETURNING id
                """, Long.class, email, nickname, role);
    }

    private Fixture insertPerformanceFixture() {
        Long stadiumId = jdbcTemplate.queryForObject("""
                INSERT INTO stadiums (name, address) VALUES ('테스트 공연장', '서울') RETURNING id
                """, Long.class);
        Long areaId = jdbcTemplate.queryForObject("""
                INSERT INTO areas (stadium_id, area_code, type, max_seat)
                VALUES (?, 'A', 'SEATED', 1000) RETURNING id
                """, Long.class, stadiumId);
        Long performanceId = jdbcTemplate.queryForObject("""
                INSERT INTO performance_general
                    (stadium_id, visible_from, title, ticketing_start_at, status)
                VALUES (?, CURRENT_DATE, '테스트 공연', now(), 'UPCOMING') RETURNING id
                """, Long.class, stadiumId);
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
                INSERT INTO stadiums (name, address) VALUES ('스탠딩 공연장', '서울') RETURNING id
                """, Long.class);
        Long areaId = jdbcTemplate.queryForObject("""
                INSERT INTO areas (stadium_id, area_code, type, max_seat)
                VALUES (?, 'S', 'STANDING', 1000) RETURNING id
                """, Long.class, stadiumId);
        Long performanceId = jdbcTemplate.queryForObject("""
                INSERT INTO performance_general
                    (stadium_id, visible_from, title, ticketing_start_at, status)
                VALUES (?, CURRENT_DATE, '스탠딩 공연', now(), 'UPCOMING') RETURNING id
                """, Long.class, stadiumId);
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
        Integer seatNumber = jdbcTemplate.queryForObject(
                "SELECT count(*)::int + 1 FROM seats WHERE area_id = ?", Integer.class, fixture.areaId());
        Long seatId = jdbcTemplate.queryForObject("""
                INSERT INTO seats (area_id, row_label, seat_number)
                VALUES (?, '3', ?) RETURNING id
                """, Long.class, fixture.areaId(), seatNumber);
        return jdbcTemplate.queryForObject("""
                INSERT INTO tickets (user_id, performance_detail_id, area_id, seat_id, status, face_id)
                VALUES (?, ?, ?, ?, 'CONFIRMED', ?) RETURNING id
                """, Long.class, userId, fixture.performanceDetailId(), fixture.areaId(), seatId, insertFace());
    }

    private Long insertStandingTicket(Long userId, Fixture fixture) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO tickets (user_id, performance_detail_id, area_id, seat_id, status, face_id)
                VALUES (?, ?, ?, NULL, 'CONFIRMED', ?) RETURNING id
                """, Long.class, userId, fixture.performanceDetailId(), fixture.areaId(), insertFace());
    }

    /** tickets.face_id 가 NOT NULL 이라 (V20260904_1430) 티켓마다 얼굴 행이 하나 필요하다 */
    private Long insertFace() {
        String zeros = "[" + "0,".repeat(127) + "0]";
        return jdbcTemplate.queryForObject("""
                INSERT INTO faces (embedding, model_version) VALUES (?::vector, 'test') RETURNING id
                """, Long.class, zeros);
    }

    private Long insertDesign(Long performanceId, String name, int totalSupply) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO nft_photocard_designs
                    (performance_general_id, name, image_url, total_supply)
                VALUES (?, ?, '/test.png', ?) RETURNING id
                """, Long.class, performanceId, name, totalSupply);
    }

    private Long insertPhotocard(Long designId, Long ticketId, Long ownerId) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO nft_photocards (design_id, ticket_id, owner_id, status)
                VALUES (?, ?, ?, 'PENDING') RETURNING id
                """, Long.class, designId, ticketId, ownerId);
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

    private record Fixture(Long performanceId, Long performanceDetailId, Long areaId) {
    }
}
