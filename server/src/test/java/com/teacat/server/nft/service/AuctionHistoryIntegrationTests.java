package com.teacat.server.nft.service;

import com.teacat.server.nft.dto.response.MyNftBidResponse;
import com.teacat.server.nft.repository.NftAuctionQueryRepository;
import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.dto.request.NftBidRequest;
import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.user.entity.UserRole;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.time.LocalDateTime;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuctionHistoryIntegrationTests extends PostgresIntegrationTest {
    @Autowired NftAuctionService service;
    @Autowired NftAuctionQueryRepository queries;
    @Autowired PlatformTransactionManager transactions;
    @Autowired MockMvc mockMvc;
    @Autowired JwtTokenProvider tokens;

    @Test
    void minuteHttpContractRejectsFractionalAmbiguousMissingAndOutOfRangeValues() throws Exception {
        Long seller = insertUser("seller@test.com", "seller");
        Long card = insertPhotocardOwnedBy(seller);
        jdbcTemplate.update("UPDATE nft_photocards SET status = 'MINTED' WHERE id = ?", card);
        String bearer = "Bearer " + tokens.createAccessToken(seller, UserRole.USER);
        for (String fields : new String[]{"", ",\"durationMinutes\":29", ",\"durationMinutes\":10081",
                ",\"durationMinutes\":30.5", ",\"durationMinutes\":-30", ",\"durationMinutes\":\"\"",
                ",\"durationMinutes\":60,\"durationHours\":1"}) {
            mockMvc.perform(post("/photocards/" + card + "/auction").header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"startPrice\":1000" + fields + "}"))
                    .andExpect(status().isBadRequest());
        }
        var before = queries.currentTime();
        mockMvc.perform(post("/photocards/" + card + "/auction").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content("{\"startPrice\":1000,\"durationMinutes\":30}"))
                .andExpect(status().isCreated());
        LocalDateTime endsAt = jdbcTemplate.queryForObject("SELECT ends_at FROM nft_auctions WHERE photocard_id = ?", LocalDateTime.class, card);
        assertThat(endsAt).isBetween(before.plusMinutes(30), queries.currentTime().plusMinutes(30));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void requestsThatWaitOnRowLockPastDeadlineCannotBidOrBuy(boolean buyNow) throws Exception {
        Long seller = insertUser("seller@test.com", "seller");
        Long bidder = insertFundedUser("bidder@test.com", "bidder", 10000);
        Long auction = insertAuction(insertPhotocardOwnedBy(seller), seller, 1000, 5000L, "now() + interval '1 day'");
        try (var executor = Executors.newSingleThreadExecutor()) {
            Future<?> pending = new TransactionTemplate(transactions).execute(status -> {
                jdbcTemplate.queryForObject("SELECT id FROM nft_auctions WHERE id = ? FOR UPDATE", Long.class, auction);
                Future<?> request = executor.submit(() -> {
                    if (buyNow) service.buyNow(bidder, auction, UUID.randomUUID().toString());
                    else service.placeBid(bidder, auction, new NftBidRequest(1500L));
                });
                long timeout = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
                boolean blocked = false;
                while (System.nanoTime() < timeout) {
                    jdbcTemplate.execute("SELECT pg_stat_clear_snapshot()");
                    blocked = Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                            "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND cardinality(pg_blocking_pids(pid)) > 0)", Boolean.class));
                    if (blocked) break;
                    jdbcTemplate.execute("SELECT pg_sleep(0.01)");
                }
                assertThat(blocked).isTrue();
                jdbcTemplate.execute("SELECT pg_sleep(0.02)");
                jdbcTemplate.update("UPDATE nft_auctions SET ends_at = clock_timestamp() - interval '1 millisecond' WHERE id = ?", auction);
                return request;
            });
            assertThatThrownBy(() -> pending.get(5, TimeUnit.SECONDS))
                    .hasCauseInstanceOf(BusinessException.class)
                    .satisfies(error -> assertThat(((BusinessException) error.getCause()).getErrorCode()).isEqualTo(NftErrorCode.AUCTION_ENDED));
            assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM nft_auction_bids WHERE auction_id = ?", Integer.class, auction)).isZero();
        }
    }

    @Test
    void periodAggregationKeepsAllTimeHighestBidAndPaginatesWithoutDuplicates() {
        Long seller = insertUser("seller@test.com", "seller");
        Long bidder = insertUser("bidder@test.com", "bidder");
        Long other = insertUser("other@test.com", "other");
        Long first = insertAuction(insertPhotocardOwnedBy(seller), seller, 1000L, null, "now() + interval '1 day'");
        Long second = insertAuction(insertPhotocardOwnedBy(seller), seller, 1000L, null, "now() + interval '1 day'");
        Long outside = insertAuction(insertPhotocardOwnedBy(seller), seller, 1000L, null, "now() + interval '1 day'");
        bid(first, bidder, 1100, "2026-09-18T23:59:59");
        bid(first, bidder, 1200, "2026-09-19T00:00:00");
        bid(first, bidder, 1300, "2026-09-19T12:00:00");
        bid(second, bidder, 1500, "2026-09-19T23:59:59.999999");
        bid(first, bidder, 5000, "2026-09-20T00:00:00");
        bid(outside, bidder, 2000, "2026-09-20T00:00:00");
        bid(outside, other, 2100, "2026-09-19T12:00:00");

        var page1 = service.getMyBids(bidder, null, 1, "2026-09-19", "2026-09-19");
        assertThat(page1.items()).extracting(MyNftBidResponse::auctionId).containsExactly(second);
        assertThat(page1.hasNext()).isTrue();
        var page2 = service.getMyBids(bidder, page1.nextCursor(), 1, "2026-09-19", "2026-09-19");
        assertThat(page2.items()).extracting(MyNftBidResponse::auctionId).containsExactly(first);
        assertThat(page2.items().getFirst().myHighestBid()).isEqualTo(5000L);
        assertThat(page2.items().getFirst().lastBidAt()).isEqualTo(LocalDateTime.parse("2026-09-19T12:00:00"));
        assertThat(page2.hasNext()).isFalse();
        assertThat(service.getMyBids(bidder, null, 20).items()).hasSize(3);
        assertThat(service.getMyBids(bidder, null, 20, "2026-09-17", "2026-09-17").items()).isEmpty();
    }

    @Test
    void databaseClockAdvancesEvenInsideOneTransaction() {
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            var before = queries.currentTime();
            jdbcTemplate.execute("SELECT pg_sleep(0.05)");
            assertThat(queries.currentTime()).isAfter(before.plusNanos(30_000_000));
        });
    }

    private void bid(Long auction, Long bidder, long amount, String at) {
        jdbcTemplate.update("INSERT INTO nft_auction_bids(auction_id, bidder_id, amount, created_at) VALUES (?, ?, ?, ?)",
                auction, bidder, amount, LocalDateTime.parse(at));
    }
}
