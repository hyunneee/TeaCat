package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.NftAuctionCreateRequest;
import com.teacat.server.nft.dto.request.NftBidRequest;
import com.teacat.server.nft.dto.request.NftListingCreateRequest;
import com.teacat.server.nft.entity.NftAuctionStatus;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftAuctionBidRepository;
import com.teacat.server.nft.repository.NftAuctionQueryRepository;
import com.teacat.server.nft.repository.NftAuctionRepository;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.wallet.exception.WalletErrorCode;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

        assertThatThrownBy(() -> auctionService.placeBid(a, auctionId, new NftBidRequest(1_500L)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isIn(NftErrorCode.AUCTION_ENDED, NftErrorCode.AUCTION_NOT_ACTIVE);
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
