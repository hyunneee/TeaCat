package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.NftAuctionCreateRequest;
import com.teacat.server.nft.dto.request.NftListingCreateRequest;
import com.teacat.server.nft.entity.NftAuctionStatus;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftAuctionBidRepository;
import com.teacat.server.nft.repository.NftAuctionQueryRepository;
import com.teacat.server.nft.repository.NftAuctionRepository;
import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;

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

    private void assertCode(org.assertj.core.api.ThrowableAssert.ThrowingCallable call, NftErrorCode expected) {
        assertThatThrownBy(call)
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(expected);
    }
}
