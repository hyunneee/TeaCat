package com.teacat.server.nft.service;

import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.NftAuctionCreateRequest;
import com.teacat.server.nft.dto.request.NftAuctionSort;
import com.teacat.server.nft.dto.request.NftBidRequest;
import com.teacat.server.nft.dto.request.NftListingCreateRequest;
import com.teacat.server.nft.dto.response.MyNftBidResponse;
import com.teacat.server.nft.dto.response.NftAuctionBidHistoryResponse;
import com.teacat.server.nft.dto.response.NftAuctionSummaryResponse;
import com.teacat.server.nft.entity.NftAuctionStatus;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftAuctionBidRepository;
import com.teacat.server.nft.repository.NftAuctionQueryRepository;
import com.teacat.server.nft.repository.NftAuctionRepository;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.user.entity.UserRole;
import com.teacat.server.wallet.exception.WalletErrorCode;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class NftAuctionServiceIntegrationTests extends PostgresIntegrationTest {

    @Autowired
    private NftAuctionRepository auctionRepository;

    @Autowired
    private NftAuctionBidRepository bidRepository;

    @Autowired
    private NftAuctionQueryRepository queryRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private NftAuctionService auctionService;

    @Autowired
    private NftService nftService;

    @Autowired
    private CatMoneyHoldService holdService;

    @Autowired
    private NftAuctionCloser closer;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private String bearer(Long userId) {
        return "Bearer " + jwtTokenProvider.createAccessToken(userId, UserRole.USER);
    }

    @Test
    void 만료된_진행중_경매만_마감_대상으로_잡힌다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long expired = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() - interval '1 minute'");
        Long running = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() + interval '1 day'");

        assertThat(auctionRepository.findExpiredActiveIds(10)).containsExactly(expired);
        transactionTemplate.executeWithoutResult(tx -> {
            assertThat(auctionRepository.findExpiredActiveForUpdate(expired)).isPresent();
            assertThat(auctionRepository.findExpiredActiveForUpdate(running)).isEmpty();
        });
    }

    @Test
    void 입찰_없는_경매만_판매자가_취소할_수_있다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long other = insertUser("o@test.com", "남");
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() + interval '1 day'");

        Integer byOther = transactionTemplate.execute(tx -> auctionRepository.cancelIfNoBids(auctionId, other));
        Integer bySeller = transactionTemplate.execute(tx -> auctionRepository.cancelIfNoBids(auctionId, sellerId));
        Integer again = transactionTemplate.execute(tx -> auctionRepository.cancelIfNoBids(auctionId, sellerId));

        assertThat(byOther).isZero();
        assertThat(bySeller).isEqualTo(1);
        assertThat(again).isZero();
        assertThat(auctionRepository.existsByPhotocardIdAndStatus(
                jdbcTemplate.queryForObject("SELECT photocard_id FROM nft_auctions WHERE id = ?", Long.class, auctionId),
                NftAuctionStatus.ACTIVE)).isFalse();
    }

    @Test
    void DB_현재_시각을_읽는다() {
        LocalDateTime dbNow = queryRepository.currentTime();

        assertThat(dbNow).isAfter(LocalDateTime.now().minusMinutes(5));
        assertThat(dbNow).isBefore(LocalDateTime.now().plusMinutes(5));
    }

    @Test
    void 소유자는_경매를_등록하고_입찰_전에는_취소할_수_있다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long photocardId = insertPhotocardOwnedBy(sellerId);

        var created = auctionService.createAuction(sellerId, photocardId,
                new NftAuctionCreateRequest(1_000L, 5_000L, 48));

        assertThat(created.status()).isEqualTo(NftAuctionStatus.ACTIVE);
        assertThat(created.currentPrice()).isEqualTo(1_000L);
        assertThat(created.endsAt()).isAfter(LocalDateTime.now().plusHours(47));
        assertThat(auctionRepository.existsByPhotocardIdAndStatus(photocardId, NftAuctionStatus.ACTIVE)).isTrue();

        auctionService.cancelAuction(sellerId, created.auctionId());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT status::text FROM nft_auctions WHERE id = ?", String.class, created.auctionId()))
                .isEqualTo("CANCELLED");
    }

    @Test
    void 경매_등록_규칙_위반은_각각의_코드로_거절된다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long other = insertUser("o@test.com", "남");
        Long photocardId = insertPhotocardOwnedBy(sellerId);

        assertCode(() -> auctionService.createAuction(other, photocardId,
                new NftAuctionCreateRequest(1_000L, null, 24)), NftErrorCode.PHOTOCARD_NOT_OWNED);
        assertCode(() -> auctionService.createAuction(sellerId, photocardId,
                new NftAuctionCreateRequest(1_000L, 1_000L, 24)), NftErrorCode.INVALID_BUY_NOW_PRICE);
        assertCode(() -> auctionService.createAuction(sellerId, photocardId,
                new NftAuctionCreateRequest(1_000L, null, 24 * 8)), NftErrorCode.INVALID_AUCTION_DURATION);

        auctionService.createAuction(sellerId, photocardId, new NftAuctionCreateRequest(1_000L, null, 24));
        assertCode(() -> auctionService.createAuction(sellerId, photocardId,
                new NftAuctionCreateRequest(1_000L, null, 24)), NftErrorCode.AUCTION_ALREADY_ACTIVE);
        assertCode(() -> nftService.registerListing(sellerId, photocardId,
                new NftListingCreateRequest(3_000L, "고정가로도 올려본다")), NftErrorCode.AUCTION_ALREADY_ACTIVE);
    }

    @Test
    void 고정가_판매_중인_포카는_경매에_올릴_수_없다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long photocardId = insertPhotocardOwnedBy(sellerId);
        nftService.registerListing(sellerId, photocardId, new NftListingCreateRequest(3_000L, "고정가 판매"));

        assertCode(() -> auctionService.createAuction(sellerId, photocardId,
                new NftAuctionCreateRequest(1_000L, null, 24)), NftErrorCode.PHOTOCARD_ALREADY_LISTED);
    }

    @Test
    void 취소_실패_사유를_구분한다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long other = insertUser("o@test.com", "남");
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() + interval '1 day'");

        assertCode(() -> auctionService.cancelAuction(other, auctionId), NftErrorCode.LISTING_OWNER_MISMATCH);
        assertCode(() -> auctionService.cancelAuction(sellerId, 999_999L), NftErrorCode.AUCTION_NOT_FOUND);

        jdbcTemplate.update("UPDATE nft_auctions SET bid_count = 1 WHERE id = ?", auctionId);
        assertCode(() -> auctionService.cancelAuction(sellerId, auctionId), NftErrorCode.AUCTION_HAS_BIDS);
    }

    @Test
    void 입찰하면_현재가가_오르고_직전_최고_입찰자의_홀드는_풀린다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long a = insertFundedUser("a@test.com", "A", 5_000);
        Long b = insertFundedUser("b@test.com", "B", 5_000);
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, 10_000L,
                "now() + interval '1 day'");

        var first = auctionService.placeBid(a, auctionId, new NftBidRequest(1_500L));
        var second = auctionService.placeBid(b, auctionId, new NftBidRequest(2_000L));

        assertThat(first.currentPrice()).isEqualTo(1_500L);
        assertThat(second.currentPrice()).isEqualTo(2_000L);
        assertThat(second.bidCount()).isEqualTo(2);
        assertThat(holdStatus("AUCTION_BID", first.bidId())).isEqualTo("RELEASED");
        assertThat(holdStatus("AUCTION_BID", second.bidId())).isEqualTo("ACTIVE");
        assertThat(holdService.availableBalance(a)).isEqualTo(5_000L);
        assertThat(holdService.availableBalance(b)).isEqualTo(3_000L);
    }

    @Test
    void 입찰_규칙_위반은_각각의_코드로_거절되고_홀드가_남지_않는다() {
        Long sellerId = insertFundedUser("s@test.com", "판매자", 5_000);
        Long a = insertFundedUser("a@test.com", "A", 5_000);
        Long poor = insertFundedUser("p@test.com", "빈털터리", 100);
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, 3_000L,
                "now() + interval '1 day'");

        assertCode(() -> auctionService.placeBid(sellerId, auctionId, new NftBidRequest(1_500L)),
                NftErrorCode.SELLER_CANNOT_BID);
        assertCode(() -> auctionService.placeBid(a, auctionId, new NftBidRequest(1_000L)),
                NftErrorCode.BID_TOO_LOW);
        assertCode(() -> auctionService.placeBid(a, auctionId, new NftBidRequest(3_000L)),
                NftErrorCode.BID_NOT_BELOW_BUY_NOW);
        assertThatThrownBy(() -> auctionService.placeBid(poor, auctionId, new NftBidRequest(1_500L)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(WalletErrorCode.INSUFFICIENT_BALANCE);

        auctionService.placeBid(a, auctionId, new NftBidRequest(1_500L));
        assertCode(() -> auctionService.placeBid(a, auctionId, new NftBidRequest(2_000L)),
                NftErrorCode.ALREADY_TOP_BIDDER);
        assertCode(() -> auctionService.placeBid(a, 999_999L, new NftBidRequest(2_000L)),
                NftErrorCode.AUCTION_NOT_FOUND);

        // 잔액 부족으로 롤백된 입찰은 행도 홀드도 남기지 않는다
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nft_auction_bids WHERE bidder_id = ?", Long.class, poor)).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM cat_money_holds WHERE user_id = ?", Long.class, poor)).isZero();
    }

    @Test
    void 마감된_경매에는_입찰할_수_없다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long a = insertFundedUser("a@test.com", "A", 5_000);
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() - interval '1 minute'");

        assertCode(() -> auctionService.placeBid(a, auctionId, new NftBidRequest(1_500L)),
                NftErrorCode.AUCTION_ENDED);
    }

    @Test
    void 동시에_입찰해도_한_건만_최고가가_되고_홀드도_하나만_남는다() throws Exception {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() + interval '1 day'");
        List<Long> bidders = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            bidders.add(insertFundedUser("b" + i + "@test.com", "B" + i, 10_000));
        }

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(bidders.size());
        List<Future<Boolean>> futures = new ArrayList<>();
        try {
            for (Long bidder : bidders) {
                futures.add(executor.submit(() -> {
                    start.await();
                    try {
                        // 모두 같은 금액 → 먼저 잡은 한 명만 성공, 나머지는 BID_TOO_LOW
                        auctionService.placeBid(bidder, auctionId, new NftBidRequest(2_000L));
                        return true;
                    } catch (BusinessException e) {
                        return false;
                    }
                }));
            }
            start.countDown();
            long successes = 0;
            for (Future<Boolean> f : futures) {
                if (f.get()) {
                    successes++;
                }
            }

            assertThat(successes).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT bid_count FROM nft_auctions WHERE id = ?", Integer.class, auctionId)).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM cat_money_holds WHERE ref_type = 'AUCTION_BID' AND status = 'ACTIVE'",
                    Long.class)).isEqualTo(1L);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void 즉시구매는_경매를_끝내고_소유권을_넘기며_최고_입찰자의_홀드를_풀어준다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long a = insertFundedUser("a@test.com", "A", 10_000);
        Long buyer = insertFundedUser("b@test.com", "구매자", 10_000);
        Long photocardId = insertPhotocardOwnedBy(sellerId);
        Long auctionId = insertAuction(photocardId, sellerId, 1_000, 5_000L, "now() + interval '1 day'");
        var bid = auctionService.placeBid(a, auctionId, new NftBidRequest(2_000L));

        var trade = auctionService.buyNow(buyer, auctionId, UUID.randomUUID().toString());

        assertThat(trade.price()).isEqualTo(5_000L);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT owner_id FROM nft_photocards WHERE id = ?", Long.class, photocardId)).isEqualTo(buyer);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT status::text FROM nft_auctions WHERE id = ?", String.class, auctionId)).isEqualTo("SOLD");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT winner_id FROM nft_auctions WHERE id = ?", Long.class, auctionId)).isEqualTo(buyer);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT auction_id FROM nft_photocard_trades WHERE id = ?", Long.class, trade.tradeId()))
                .isEqualTo(auctionId);
        assertThat(holdStatus("AUCTION_BID", bid.bidId())).isEqualTo("RELEASED");
        assertThat(holdStatus("AUCTION_BUY_NOW", auctionId)).isEqualTo("CAPTURED");
        assertThat(holdService.availableBalance(a)).isEqualTo(10_000L);
        // 구매/판매 내역 API 가 경매 거래를 그대로 보여준다
        assertThat(nftService.getPurchaseHistory(buyer, null, 20).items()).hasSize(1);
        assertThat(nftService.getSaleHistory(sellerId, null, 20).items()).hasSize(1);
        assertThat(nftService.getPhotocardTrades(photocardId, null, 20).items()).hasSize(1);
    }

    @Test
    void 같은_멱등키로_즉시구매를_재요청하면_같은_거래를_돌려준다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long buyer = insertFundedUser("b@test.com", "구매자", 10_000);
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, 5_000L,
                "now() + interval '1 day'");
        String key = UUID.randomUUID().toString();

        var first = auctionService.buyNow(buyer, auctionId, key);
        var second = auctionService.buyNow(buyer, auctionId, key);

        assertThat(second.tradeId()).isEqualTo(first.tradeId());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nft_photocard_trades WHERE auction_id = ?", Long.class, auctionId)).isEqualTo(1L);
    }

    @Test
    void 즉시구매_규칙_위반은_각각의_코드로_거절된다() {
        Long sellerId = insertFundedUser("s@test.com", "판매자", 10_000);
        Long buyer = insertFundedUser("b@test.com", "구매자", 10_000);
        Long poor = insertFundedUser("p@test.com", "빈털터리", 10);
        Long noBuyNow = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() + interval '1 day'");
        Long withBuyNow = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, 5_000L,
                "now() + interval '1 day'");

        assertCode(() -> auctionService.buyNow(buyer, noBuyNow, UUID.randomUUID().toString()),
                NftErrorCode.BUY_NOW_NOT_AVAILABLE);
        assertCode(() -> auctionService.buyNow(sellerId, withBuyNow, UUID.randomUUID().toString()),
                NftErrorCode.SELF_PURCHASE_NOT_ALLOWED);
        assertCode(() -> auctionService.buyNow(buyer, withBuyNow, "not-a-uuid"),
                NftErrorCode.INVALID_IDEMPOTENCY_KEY);
        assertThatThrownBy(() -> auctionService.buyNow(poor, withBuyNow, UUID.randomUUID().toString()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(WalletErrorCode.INSUFFICIENT_BALANCE);

        auctionService.buyNow(buyer, withBuyNow, UUID.randomUUID().toString());
        assertCode(() -> auctionService.buyNow(buyer, withBuyNow, UUID.randomUUID().toString()),
                NftErrorCode.AUCTION_NOT_ACTIVE);
        assertCode(() -> auctionService.placeBid(buyer, withBuyNow, new NftBidRequest(2_000L)),
                NftErrorCode.AUCTION_NOT_ACTIVE);
    }

    @Test
    void 마감_시_최고_입찰자에게_낙찰되고_거래_이력이_남는다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long a = insertFundedUser("a@test.com", "A", 10_000);
        Long b = insertFundedUser("b@test.com", "B", 10_000);
        Long photocardId = insertPhotocardOwnedBy(sellerId);
        Long auctionId = insertAuction(photocardId, sellerId, 1_000, null, "now() + interval '1 day'");
        auctionService.placeBid(a, auctionId, new NftBidRequest(1_500L));
        var top = auctionService.placeBid(b, auctionId, new NftBidRequest(2_000L));
        jdbcTemplate.update("UPDATE nft_auctions SET ends_at = now() - interval '1 second' WHERE id = ?", auctionId);

        boolean closed = closer.close(auctionId);

        assertThat(closed).isTrue();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT status::text FROM nft_auctions WHERE id = ?", String.class, auctionId)).isEqualTo("SOLD");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT winner_id FROM nft_auctions WHERE id = ?", Long.class, auctionId)).isEqualTo(b);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT owner_id FROM nft_photocards WHERE id = ?", Long.class, photocardId)).isEqualTo(b);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT price FROM nft_photocard_trades WHERE auction_id = ?", Long.class, auctionId)).isEqualTo(2_000L);
        assertThat(holdStatus("AUCTION_BID", top.bidId())).isEqualTo("CAPTURED");
        assertThat(nftService.getPurchaseHistory(b, null, 20).items()).hasSize(1);
    }

    @Test
    void 입찰_없이_마감되면_유찰이다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long photocardId = insertPhotocardOwnedBy(sellerId);
        Long auctionId = insertAuction(photocardId, sellerId, 1_000, null, "now() - interval '1 second'");

        assertThat(closer.close(auctionId)).isTrue();

        assertThat(jdbcTemplate.queryForObject(
                "SELECT status::text FROM nft_auctions WHERE id = ?", String.class, auctionId)).isEqualTo("EXPIRED");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT owner_id FROM nft_photocards WHERE id = ?", Long.class, photocardId)).isEqualTo(sellerId);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nft_photocard_trades WHERE auction_id = ?", Long.class, auctionId)).isZero();
    }

    @Test
    void 마감_전이거나_이미_닫힌_경매는_close_가_아무것도_하지_않는다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long running = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() + interval '1 day'");
        Long expired = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() - interval '1 second'");

        assertThat(closer.close(running)).isFalse();
        assertThat(closer.close(expired)).isTrue();
        assertThat(closer.close(expired)).isFalse();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT status::text FROM nft_auctions WHERE id = ?", String.class, running)).isEqualTo("ACTIVE");
    }

    @Test
    void 같은_경매를_동시에_닫아도_한_번만_처리된다() throws Exception {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long a = insertFundedUser("a@test.com", "A", 10_000);
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() + interval '1 day'");
        auctionService.placeBid(a, auctionId, new NftBidRequest(1_500L));
        jdbcTemplate.update("UPDATE nft_auctions SET ends_at = now() - interval '1 second' WHERE id = ?", auctionId);

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(6);
        List<Future<Boolean>> futures = new ArrayList<>();
        try {
            for (int i = 0; i < 6; i++) {
                futures.add(executor.submit(() -> {
                    start.await();
                    return closer.close(auctionId);
                }));
            }
            start.countDown();
            long closedCount = 0;
            for (Future<Boolean> f : futures) {
                if (f.get()) {
                    closedCount++;
                }
            }

            assertThat(closedCount).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM nft_photocard_trades WHERE auction_id = ?", Long.class, auctionId)).isEqualTo(1L);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void 마감_시각이_지난_경매는_입찰과_즉시구매를_거절하고_마감은_close_가_처리한다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long a = insertFundedUser("a@test.com", "A", 10_000);
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, 5_000L,
                "now() - interval '1 second'");

        // 쓰기 경로는 닫지 않고 거절만 한다. 같은 트랜잭션에서 닫으면 거절 예외의 롤백이 마감까지 되돌리기 때문이다
        assertCode(() -> auctionService.placeBid(a, auctionId, new NftBidRequest(1_500L)),
                NftErrorCode.AUCTION_ENDED);
        assertCode(() -> auctionService.buyNow(a, auctionId, UUID.randomUUID().toString()),
                NftErrorCode.AUCTION_ENDED);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT status::text FROM nft_auctions WHERE id = ?", String.class, auctionId)).isEqualTo("ACTIVE");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM cat_money_holds WHERE user_id = ?", Long.class, a)).isZero();

        // 마감은 스위퍼(또는 상세 조회)가 부르는 close 가 한다
        assertThat(closer.close(auctionId)).isTrue();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT status::text FROM nft_auctions WHERE id = ?", String.class, auctionId)).isEqualTo("EXPIRED");
        assertCode(() -> auctionService.placeBid(a, auctionId, new NftBidRequest(1_500L)),
                NftErrorCode.AUCTION_NOT_ACTIVE);
    }

    @Test
    void 진행_중_경매_목록은_마감_임박순이_기본이고_커서로_이어진다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long late = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null, "now() + interval '3 day'");
        Long soon = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 3_000, null, "now() + interval '1 day'");
        Long mid = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 2_000, null, "now() + interval '2 day'");
        insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 500, null, "now() - interval '1 minute'"); // 만료 → 목록에 없음

        var page1 = auctionService.getAuctions(null, null, NftAuctionSort.ENDING_SOON, null, 2);
        var page2 = auctionService.getAuctions(null, null, NftAuctionSort.ENDING_SOON, page1.nextCursor(), 2);

        assertThat(page1.items()).extracting(NftAuctionSummaryResponse::auctionId).containsExactly(soon, mid);
        assertThat(page1.hasNext()).isTrue();
        assertThat(page2.items()).extracting(NftAuctionSummaryResponse::auctionId).containsExactly(late);
        assertThat(page2.hasNext()).isFalse();

        var byPrice = auctionService.getAuctions(null, null, NftAuctionSort.CURRENT_PRICE, null, 10);
        assertThat(byPrice.items()).extracting(NftAuctionSummaryResponse::currentPrice)
                .containsExactly(1_000L, 2_000L, 3_000L);
    }

    @Test
    void 상세는_요청자_관점을_담고_만료된_경매는_먼저_닫아서_보여준다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long a = insertFundedUser("a@test.com", "A", 10_000);
        Long b = insertFundedUser("b@test.com", "B", 10_000);
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, 9_000L,
                "now() + interval '1 day'");
        auctionService.placeBid(a, auctionId, new NftBidRequest(1_500L));
        auctionService.placeBid(b, auctionId, new NftBidRequest(2_000L));

        var asSeller = auctionService.getAuction(auctionId, sellerId);
        var asA = auctionService.getAuction(auctionId, a);
        var anonymous = auctionService.getAuction(auctionId, null);

        assertThat(asSeller.viewer().isSeller()).isTrue();
        assertThat(asA.viewer().isTopBidder()).isFalse();
        assertThat(asA.viewer().myHighestBid()).isEqualTo(1_500L);
        assertThat(anonymous.viewer()).isNull();
        assertThat(anonymous.topBidderNickname()).isEqualTo("B");
        assertThat(anonymous.bidCount()).isEqualTo(2);
        assertThat(anonymous.finalPrice()).isNull();

        jdbcTemplate.update("UPDATE nft_auctions SET ends_at = now() - interval '1 second' WHERE id = ?", auctionId);
        var closed = auctionService.getAuction(auctionId, b);

        assertThat(closed.status()).isEqualTo(NftAuctionStatus.SOLD);
        assertThat(closed.winnerNickname()).isEqualTo("B");
        assertThat(closed.finalPrice()).isEqualTo(2_000L);
        assertCode(() -> auctionService.getAuction(999_999L, null), NftErrorCode.AUCTION_NOT_FOUND);
    }

    @Test
    void 입찰_이력과_내_입찰_목록이_결과를_구분한다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long a = insertFundedUser("a@test.com", "A", 10_000);
        Long b = insertFundedUser("b@test.com", "B", 10_000);
        Long won = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null, "now() + interval '1 day'");
        Long running = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null, "now() + interval '1 day'");
        auctionService.placeBid(a, won, new NftBidRequest(1_500L));
        auctionService.placeBid(b, won, new NftBidRequest(2_000L));
        auctionService.placeBid(a, won, new NftBidRequest(2_500L));
        auctionService.placeBid(a, running, new NftBidRequest(1_200L));
        auctionService.placeBid(b, running, new NftBidRequest(1_300L));
        jdbcTemplate.update("UPDATE nft_auctions SET ends_at = now() - interval '1 second' WHERE id = ?", won);
        closer.close(won);

        var bids = auctionService.getBids(won, null, 10);
        var myBidsA = auctionService.getMyBids(a, null, 10);
        var myBidsB = auctionService.getMyBids(b, null, 10);

        assertThat(bids.items()).extracting(NftAuctionBidHistoryResponse::amount).containsExactly(2_500L, 2_000L, 1_500L);
        assertThat(myBidsA.items()).hasSize(2);
        assertThat(myBidsA.items()).extracting(MyNftBidResponse::auctionId).containsExactly(running, won);
        assertThat(myBidsA.items().get(0).result()).isEqualTo(MyNftBidResponse.Result.OUTBID);
        assertThat(myBidsA.items().get(1).result()).isEqualTo(MyNftBidResponse.Result.WON);
        assertThat(myBidsA.items().get(1).myHighestBid()).isEqualTo(2_500L);
        assertThat(myBidsB.items()).extracting(MyNftBidResponse::result)
                .containsExactly(MyNftBidResponse.Result.BIDDING, MyNftBidResponse.Result.LOST);
    }

    @Test
    void 내_경매_목록은_상태로_거른다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long active = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null, "now() + interval '1 day'");
        Long expired = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null, "now() - interval '1 second'");
        closer.close(expired);

        var all = auctionService.getMyAuctions(sellerId, null, null, 10);
        var onlyExpired = auctionService.getMyAuctions(sellerId, NftAuctionStatus.EXPIRED, null, 10);

        assertThat(all.items()).extracting(NftAuctionSummaryResponse::auctionId).containsExactly(expired, active);
        assertThat(onlyExpired.items()).extracting(NftAuctionSummaryResponse::auctionId).containsExactly(expired);
        assertThat(onlyExpired.items().get(0).status()).isEqualTo(NftAuctionStatus.EXPIRED);
    }

    @Test
    void 경매_조회는_토큰_없이_열려_있고_쓰기는_401이다() throws Exception {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() + interval '1 day'");

        mockMvc.perform(get("/nft-market/auctions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        // 비로그인 상세에는 viewer 블록이 없다 (null 필드는 봉투에서 빠진다)
        mockMvc.perform(get("/auctions/" + auctionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.auctionId").value(auctionId))
                .andExpect(jsonPath("$.data.viewer").doesNotExist());
        mockMvc.perform(get("/auctions/" + auctionId + "/bids"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/auctions/" + auctionId + "/bids")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":2000}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/auctions/" + auctionId))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/users/me/auctions"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/users/me/bids"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 등록부터_즉시구매까지_HTTP_로_동작한다() throws Exception {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long bidderId = insertFundedUser("b@test.com", "입찰자", 10_000);
        Long buyerId = insertFundedUser("c@test.com", "즉시구매자", 10_000);
        Long photocardId = insertPhotocardOwnedBy(sellerId);

        mockMvc.perform(post("/photocards/" + photocardId + "/auction")
                        .header(HttpHeaders.AUTHORIZATION, bearer(sellerId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"startPrice":1000,"buyNowPrice":5000,"durationHours":24}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.photocardId").value(photocardId))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.currentPrice").value(1000));

        Long auctionId = jdbcTemplate.queryForObject(
                "SELECT id FROM nft_auctions WHERE photocard_id = ?", Long.class, photocardId);

        mockMvc.perform(post("/auctions/" + auctionId + "/bids")
                        .header(HttpHeaders.AUTHORIZATION, bearer(bidderId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":1500}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.currentPrice").value(1500))
                .andExpect(jsonPath("$.data.bidCount").value(1))
                .andExpect(jsonPath("$.data.isTopBidder").value(true));

        mockMvc.perform(get("/auctions/" + auctionId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(bidderId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.topBidderNickname").value("입찰자"))
                .andExpect(jsonPath("$.data.viewer.isSeller").value(false))
                .andExpect(jsonPath("$.data.viewer.isTopBidder").value(true))
                .andExpect(jsonPath("$.data.viewer.myHighestBid").value(1500));

        mockMvc.perform(get("/auctions/" + auctionId + "/bids"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].bidderNickname").value("입찰자"))
                .andExpect(jsonPath("$.data.items[0].amount").value(1500));

        mockMvc.perform(post("/auctions/" + auctionId + "/buy-now")
                        .header(HttpHeaders.AUTHORIZATION, bearer(buyerId))
                        .header("Idempotency-Key", UUID.randomUUID().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.photocardId").value(photocardId))
                .andExpect(jsonPath("$.data.price").value(5000));

        mockMvc.perform(get("/users/me/auctions")
                        .header(HttpHeaders.AUTHORIZATION, bearer(sellerId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].auctionId").value(auctionId))
                .andExpect(jsonPath("$.data.items[0].status").value("SOLD"))
                .andExpect(jsonPath("$.data.items[0].winnerNickname").value("즉시구매자"));

        mockMvc.perform(get("/users/me/bids")
                        .header(HttpHeaders.AUTHORIZATION, bearer(bidderId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].auctionId").value(auctionId))
                .andExpect(jsonPath("$.data.items[0].myHighestBid").value(1500))
                .andExpect(jsonPath("$.data.items[0].result").value("LOST"));
    }

    @Test
    void 판매자는_HTTP_로_경매를_취소한다() throws Exception {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() + interval '1 day'");

        mockMvc.perform(delete("/auctions/" + auctionId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(sellerId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("경매가 취소되었습니다."));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT status::text FROM nft_auctions WHERE id = ?", String.class, auctionId))
                .isEqualTo("CANCELLED");
    }

    @Test
    void 입찰_실패는_에러_코드_봉투로_내려온다() throws Exception {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long bidderId = insertFundedUser("b@test.com", "입찰자", 10_000);
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() + interval '1 day'");

        // 비즈니스 규칙 위반 → BusinessException → code 가 실린다
        mockMvc.perform(post("/auctions/" + auctionId + "/bids")
                        .header(HttpHeaders.AUTHORIZATION, bearer(bidderId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":900}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("NFT_027"));

        // @Valid 위반 → GlobalExceptionHandler 가 code 없이 첫 필드 메시지만 내려준다
        mockMvc.perform(post("/auctions/" + auctionId + "/bids")
                        .header(HttpHeaders.AUTHORIZATION, bearer(bidderId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("입찰가를 1 이상으로 입력해 주세요."));

        // 즉시구매가 없는 경매
        mockMvc.perform(post("/auctions/" + auctionId + "/buy-now")
                        .header(HttpHeaders.AUTHORIZATION, bearer(bidderId))
                        .header("Idempotency-Key", UUID.randomUUID().toString()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NFT_029"));
    }

    @Test
    void 포토카드_상세에_진행_중_경매가_실린다() throws Exception {
        Long sellerId = insertUser("s@test.com", "판매자");
        Long photocardId = insertPhotocardOwnedBy(sellerId);
        auctionService.createAuction(sellerId, photocardId, new NftAuctionCreateRequest(1_000L, 5_000L, 24));
        Long auctionId = jdbcTemplate.queryForObject(
                "SELECT id FROM nft_auctions WHERE photocard_id = ?", Long.class, photocardId);

        mockMvc.perform(get("/photocards/" + photocardId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.auction.auctionId").value(auctionId))
                .andExpect(jsonPath("$.data.auction.currentPrice").value(1000))
                .andExpect(jsonPath("$.data.auction.buyNowPrice").value(5000))
                .andExpect(jsonPath("$.data.auction.bidCount").value(0))
                // 고정가와 경매는 동시에 존재할 수 없다
                .andExpect(jsonPath("$.data.listing").doesNotExist());

        auctionService.cancelAuction(sellerId, auctionId);

        mockMvc.perform(get("/photocards/" + photocardId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.auction").doesNotExist());
    }

    private String holdStatus(String refType, Long refId) {
        return jdbcTemplate.queryForObject(
                "SELECT status::text FROM cat_money_holds WHERE ref_type = ?::cat_money_hold_ref_type AND ref_id = ?",
                String.class, refType, refId);
    }

    private void assertCode(org.assertj.core.api.ThrowableAssert.ThrowingCallable call, NftErrorCode expected) {
        assertThatThrownBy(call)
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(expected);
    }
}
