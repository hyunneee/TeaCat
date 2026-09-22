package com.teacat.server.nft.service;

import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.nft.dto.request.NftBidRequest;
import com.teacat.server.nft.entity.NftAuctionStatus;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.user.entity.UserRole;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 어드민 경매 관리 — {@code /admin/nft/auctions}.
 *
 * <p>이 테스트가 지키는 것은 셋이다.
 * <ol>
 *   <li><b>ADMIN 만</b> 닿는다 — 경매 목록에는 판매자·입찰자 닉네임이 다 들어 있다.</li>
 *   <li>강제 취소가 <b>담보를 푼다</b> — 잊으면 입찰자의 캣머니가 영구히 묶인다.</li>
 *   <li>마감 시각이 지난 경매는 <b>취소되지 않는다</b> — 그 틈에 취소하면 정당한 낙찰자의
 *       낙찰을 빼앗는다.</li>
 * </ol>
 */
class NftAuctionAdminApiIntegrationTests extends PostgresIntegrationTest {

    /** 발행이 끝난 카드만 경매에 올릴 수 있다 (NftAuctionServiceIntegrationTests 와 같은 이유) */
    @Override
    protected Long insertPhotocardOwnedBy(Long ownerId) {
        Long photocardId = super.insertPhotocardOwnedBy(ownerId);
        jdbcTemplate.update("UPDATE nft_photocards SET status = 'MINTED' WHERE id = ?", photocardId);
        return photocardId;
    }

    /**
     * 🔴 테스트마다 **한 번만** 만든다. 메서드에서 부를 때마다 만들면 한 테스트에서 두 번
     *    부르는 순간 이메일 unique 제약에 걸린다(실제로 걸렸다). 부모의 cleanDatabase 가
     *    먼저 돌아 users 를 비우므로 여기서 다시 넣는 것이 맞다.
     */
    private String adminToken;

    @BeforeEach
    void signInAdmin() {
        adminToken = "Bearer " + jwtTokenProvider.createAccessToken(
                insertUser("admin@test.com", "운영자", "ADMIN"), UserRole.ADMIN);
    }

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtTokenProvider jwtTokenProvider;
    @Autowired private NftAuctionService auctionService;
    @Autowired private CatMoneyHoldService holdService;

    @Test
    void 어드민은_모든_상태의_경매를_본다() throws Exception {
        Long sellerId = insertUser("seller@test.com", "판매자");
        insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null, "now() + interval '1 day'");
        Long cancelled = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 2_000, null,
                "now() + interval '1 day'");
        jdbcTemplate.update("UPDATE nft_auctions SET status = 'CANCELLED', closed_at = now() WHERE id = ?",
                cancelled);

        mockMvc.perform(get("/admin/nft/auctions").header("Authorization", adminToken))
                .andExpect(status().isOk())
                // 진행 중인 것만 주는 사용자 목록과 달리 취소된 경매도 보여야 한다
                .andExpect(jsonPath("$.data.auctions.length()").value(2))
                .andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.totalPages").value(1))
                .andExpect(jsonPath("$.data.auctions[0].sellerNickname").value("판매자"));
    }

    @Test
    void 상태와_검색어로_거른다() throws Exception {
        Long sellerId = insertUser("seller@test.com", "김판매");
        Long other = insertUser("other@test.com", "박판매");
        insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null, "now() + interval '1 day'");
        Long cancelled = insertAuction(insertPhotocardOwnedBy(other), other, 2_000, null,
                "now() + interval '1 day'");
        /* closed_at 을 같이 넣어야 한다 — ACTIVE 가 아니면 닫힌 시각이 있어야 하는 제약이 있다
           (chk_nft_auctions_closed). 상태만 바꾸면 INSERT 가 거절된다. */
        jdbcTemplate.update("UPDATE nft_auctions SET status = 'CANCELLED', closed_at = now() WHERE id = ?",
                cancelled);

        mockMvc.perform(get("/admin/nft/auctions").param("status", "ACTIVE")
                        .header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.auctions[0].sellerNickname").value("김판매"));

        // 판매자 닉네임으로도 찾는다 — 어드민은 사람을 기준으로 뒤진다
        mockMvc.perform(get("/admin/nft/auctions").param("keyword", "박판매")
                        .header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.auctions[0].sellerNickname").value("박판매"));
    }

    @Test
    void 상세에_입찰_이력이_함께_온다() throws Exception {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Long bidder = insertFundedUser("bidder@test.com", "입찰자", 10_000);
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() + interval '1 day'");
        auctionService.placeBid(bidder, auctionId, new NftBidRequest(1_500L));

        mockMvc.perform(get("/admin/nft/auctions/" + auctionId).header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.auction.auctionId").value(auctionId))
                .andExpect(jsonPath("$.data.auction.bidCount").value(1))
                .andExpect(jsonPath("$.data.auction.cancellable").value(true))
                .andExpect(jsonPath("$.data.sellerId").value(sellerId))
                .andExpect(jsonPath("$.data.topBidderId").value(bidder))
                .andExpect(jsonPath("$.data.bids.length()").value(1))
                .andExpect(jsonPath("$.data.bids[0].amount").value(1_500))
                .andExpect(jsonPath("$.data.bids[0].bidderNickname").value("입찰자"));
    }

    /** 🔴 담보를 풀지 않으면 입찰자의 캣머니가 영구히 묶인다 */
    @Test
    void 강제_취소는_입찰이_있어도_되고_담보를_풀어_준다() throws Exception {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Long bidder = insertFundedUser("bidder@test.com", "입찰자", 10_000);
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() + interval '1 day'");
        Long bidId = auctionService.placeBid(bidder, auctionId, new NftBidRequest(1_500L)).bidId();
        assertThat(holdStatus("AUCTION_BID", bidId)).isEqualTo("ACTIVE");
        assertThat(holdService.availableBalance(bidder)).isEqualTo(8_500L);

        mockMvc.perform(post("/admin/nft/auctions/" + auctionId + "/cancel")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"판매자 사칭 신고\"}"))
                .andExpect(status().isOk());

        assertThat(auctionStatus(auctionId)).isEqualTo(NftAuctionStatus.CANCELLED.name());
        assertThat(holdStatus("AUCTION_BID", bidId)).isEqualTo("RELEASED");
        assertThat(holdService.availableBalance(bidder)).isEqualTo(10_000L);
    }

    /**
     * 🔴 마감 시각이 지난 경매를 취소하면 정당한 낙찰자의 낙찰을 빼앗는다.
     * 스위퍼가 곧 낙찰로 닫을 것이므로 여기서는 거절하고 거래 심사로 넘긴다.
     */
    @Test
    void 마감_시각이_지난_경매는_취소하지_않는다() throws Exception {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() - interval '1 minute'");

        mockMvc.perform(post("/admin/nft/auctions/" + auctionId + "/cancel")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"신고 접수\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NFT_064"));

        assertThat(auctionStatus(auctionId)).isEqualTo(NftAuctionStatus.ACTIVE.name());
        // 목록에서도 취소할 수 없다고 알려 줘야 어드민이 헛되이 누르지 않는다
        mockMvc.perform(get("/admin/nft/auctions/" + auctionId).header("Authorization", adminToken))
                .andExpect(jsonPath("$.data.auction.cancellable").value(false));
    }

    @Test
    void 정산이_시작된_경매는_취소하지_않는다() throws Exception {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() + interval '1 day'");
        /* SETTLING 에는 낙찰자가 반드시 있어야 한다(chk_nft_auctions_winner).
           닫힌 시각까지 함께 넣어야 두 제약을 다 만족한다. */
        Long winner = insertUser("winner@test.com", "낙찰자");
        jdbcTemplate.update(
                "UPDATE nft_auctions SET status = 'SETTLING', winner_id = ?, closed_at = now() WHERE id = ?",
                winner, auctionId);

        mockMvc.perform(post("/admin/nft/auctions/" + auctionId + "/cancel")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"신고 접수\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void 사유_없이는_취소하지_않는다() throws Exception {
        Long sellerId = insertUser("seller@test.com", "판매자");
        Long auctionId = insertAuction(insertPhotocardOwnedBy(sellerId), sellerId, 1_000, null,
                "now() + interval '1 day'");

        mockMvc.perform(post("/admin/nft/auctions/" + auctionId + "/cancel")
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"   \"}"))
                .andExpect(status().isBadRequest());

        assertThat(auctionStatus(auctionId)).isEqualTo(NftAuctionStatus.ACTIVE.name());
    }

    /** 🔴 목록에 판매자·입찰자 닉네임이 다 들어 있다. 일반 회원에게 열리면 안 된다 */
    @Test
    void 일반_회원과_비로그인은_거절한다() throws Exception {
        Long userId = insertUser("user@test.com", "일반회원");
        String userToken = "Bearer " + jwtTokenProvider.createAccessToken(userId, UserRole.USER);

        mockMvc.perform(get("/admin/nft/auctions").header("Authorization", userToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/admin/nft/auctions"))
                .andExpect(status().isUnauthorized());
    }

    private String auctionStatus(Long auctionId) {
        return jdbcTemplate.queryForObject(
                "SELECT status::text FROM nft_auctions WHERE id = ?", String.class, auctionId);
    }

    private String holdStatus(String refType, Long refId) {
        return jdbcTemplate.queryForObject(
                "SELECT status::text FROM cat_money_holds WHERE ref_type = ?::cat_money_hold_ref_type AND ref_id = ?",
                String.class, refType, refId);
    }
}
