package com.teacat.server.nft.service;

import com.teacat.server.nft.entity.NftAuctionStatus;
import com.teacat.server.nft.repository.NftAuctionBidRepository;
import com.teacat.server.nft.repository.NftAuctionQueryRepository;
import com.teacat.server.nft.repository.NftAuctionRepository;
import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class NftAuctionServiceIntegrationTests extends PostgresIntegrationTest {

    @Autowired
    private NftAuctionRepository auctionRepository;

    @Autowired
    private NftAuctionBidRepository bidRepository;

    @Autowired
    private NftAuctionQueryRepository queryRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

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
}
