package com.teacat.server.nft.service;

import com.teacat.server.auth.security.ClientRequest;
import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.NftBidRequest;
import com.teacat.server.nft.dto.request.NftListingCreateRequest;
import com.teacat.server.nft.entity.NftReviewSeverity;
import com.teacat.server.nft.entity.NftTradeReview;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftTradeReviewRepository;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.user.entity.UserRole;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 이상거래 심사 — 구매 성립 → 체인 전송 전 심사 → 보류 → 관리자 결정 (AUCTION_FRAUD_DESIGN.md 4·6·8장).
 *
 * <p>정산 프로세서 대신 {@code writer.screen} 을 직접 부른다. 프로세서가 그것을 부르는 것은 단위 테스트가 확인한다.
 * 기본 픽스처의 회원은 전화번호가 모두 같아(R2) 그대로 두면 모든 거래가 걸린다 — 정상 거래를 만들 때는 번호를 갈라 준다.
 */
/** 보류(HOLD) 모드 — 기본은 FLAG 라 여기서만 켠다 */
@TestPropertySource(properties = "nft.trade.review.mode=HOLD")
class NftTradeRiskReviewIntegrationTests extends PostgresIntegrationTest {

    private static final ClientRequest SELLER_DEVICE = ClientRequest.of("10.0.0.7", "Mozilla/5.0 (seller)");
    private static final ClientRequest OTHER_DEVICE = ClientRequest.of("203.0.113.5", "Mozilla/5.0 (other)");

    @Override
    protected Long insertPhotocardOwnedBy(Long ownerId) {
        Long photocardId = super.insertPhotocardOwnedBy(ownerId);
        jdbcTemplate.update("UPDATE nft_photocards SET status = 'MINTED' WHERE id = ?", photocardId);
        return photocardId;
    }

    @Autowired private NftAuctionService auctionService;
    @Autowired private NftService nftService;
    @Autowired private NftAuctionCloser closer;
    @Autowired private NftTradeSettlementWriter writer;
    @Autowired private NftTradeReviewService reviewService;
    @Autowired private NftTradeReviewRepository reviewRepository;
    @Autowired private CatMoneyHoldService holdService;
    @Autowired private MockMvc mockMvc;
    @Autowired private JwtTokenProvider jwtTokenProvider;

    @Test
    void 판매자와_같은_단말의_부계정이_낙찰하면_체인_전송_전에_보류되고_홀드와_카드는_그대로다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        insertWallet(sellerId); // 정산 명령(writer.command)이 판매자 지갑을 조회한다
        Long alt = insertFundedUser("alt@test.com", "부계정", 10_000);
        Long honest = insertFundedUser("h@test.com", "정직", 10_000);
        distinctPhones(sellerId, alt, honest);
        Long photocardId = insertPhotocardOwnedBy(sellerId);
        Long auctionId = insertAuctionWithDevice(photocardId, sellerId, SELLER_DEVICE);

        auctionService.placeBid(honest, auctionId, new NftBidRequest(1_500L), OTHER_DEVICE);
        var top = auctionService.placeBid(alt, auctionId, new NftBidRequest(2_000L), SELLER_DEVICE);
        jdbcTemplate.update("UPDATE nft_auctions SET ends_at = now() - interval '1 second' WHERE id = ?", auctionId);
        assertThat(closer.close(auctionId)).isTrue();
        Long tradeId = tradeIdOf(auctionId);

        boolean held = writer.screen(tradeId);

        assertThat(held).isTrue();
        assertThat(chainStatus(tradeId)).isEqualTo("RISK_REVIEW");
        NftTradeReview review = reviewRepository.findByTradeId(tradeId).orElseThrow();
        assertThat(review.getMaxSeverity()).isEqualTo(NftReviewSeverity.HIGH);
        assertThat(review.getSignals()).anyMatch(s -> s.rule().equals(TradeRiskSameDeviceRule.CODE)
                && s.severity() == NftReviewSeverity.HIGH);
        // 돈도 카드도 움직이지 않았다
        assertThat(holdStatus("AUCTION_BID", top.bidId())).isEqualTo("ACTIVE");
        assertThat(holdStatus("NFT_TRADE_SELLER", tradeId)).isEqualTo("ACTIVE");
        assertThat(ownerOf(photocardId)).isEqualTo(sellerId);
        assertThat(auctionStatus(auctionId)).isEqualTo("SETTLING");
        // 사용자에게는 정산 대기로만 보인다
        assertThat(nftService.getTradeStatus(alt, tradeId).status().name()).isEqualTo("PENDING");
        // 두 번 심사하지 않는다
        assertThat(writer.screen(tradeId)).isFalse();
    }

    @Test
    void 거절하면_홀드가_풀리고_경매는_유찰_카드는_판매자에게_남는다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        insertWallet(sellerId); // 정산 명령(writer.command)이 판매자 지갑을 조회한다
        Long alt = insertFundedUser("alt@test.com", "부계정", 10_000);
        Long admin = insertUser("admin@test.com", "관리자", "ADMIN");
        distinctPhones(sellerId, alt, admin);
        Long photocardId = insertPhotocardOwnedBy(sellerId);
        Long auctionId = insertAuctionWithDevice(photocardId, sellerId, SELLER_DEVICE);
        var top = auctionService.placeBid(alt, auctionId, new NftBidRequest(2_000L), SELLER_DEVICE);
        jdbcTemplate.update("UPDATE nft_auctions SET ends_at = now() - interval '1 second' WHERE id = ?", auctionId);
        closer.close(auctionId);
        Long tradeId = tradeIdOf(auctionId);
        assertThat(writer.screen(tradeId)).isTrue();
        Long reviewId = reviewRepository.findByTradeId(tradeId).orElseThrow().getId();

        assertThatThrownBy(() -> reviewService.reject(admin, reviewId, " "))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(NftErrorCode.TRADE_REVIEW_NOTE_REQUIRED);

        reviewService.reject(admin, reviewId, "판매자와 최고 입찰자가 같은 기기");

        assertThat(chainStatus(tradeId)).isEqualTo("FAILED");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT failure_code FROM nft_photocard_trades WHERE id = ?", String.class, tradeId))
                .isEqualTo("RISK_REJECTED");
        assertThat(holdStatus("AUCTION_BID", top.bidId())).isEqualTo("RELEASED");
        assertThat(holdStatus("NFT_TRADE_SELLER", tradeId)).isEqualTo("RELEASED");
        assertThat(holdService.availableBalance(alt)).isEqualTo(10_000L);
        assertThat(auctionStatus(auctionId)).isEqualTo("EXPIRED");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT winner_id FROM nft_auctions WHERE id = ?", Long.class, auctionId)).isNull();
        assertThat(ownerOf(photocardId)).isEqualTo(sellerId);
        NftTradeReview review = reviewRepository.findById(reviewId).orElseThrow();
        assertThat(review.isDecided()).isTrue();
        assertThat(review.getDecidedBy()).isEqualTo(admin);
        // 사용자에게는 실패 사유가 보이지 않는다
        assertThat(nftService.getTradeStatus(alt, tradeId).failureCode()).isNull();
        // 결정은 한 번뿐이다
        assertThatThrownBy(() -> reviewService.approve(admin, reviewId, null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(NftErrorCode.TRADE_REVIEW_ALREADY_DECIDED);
    }

    @Test
    void 승인하면_PENDING_으로_돌아가_정산_스케줄러가_집고_다시_심사하지_않는다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        insertWallet(sellerId); // 정산 명령(writer.command)이 판매자 지갑을 조회한다
        Long alt = insertFundedUser("alt@test.com", "부계정", 10_000);
        Long admin = insertUser("admin@test.com", "관리자", "ADMIN");
        distinctPhones(sellerId, alt, admin);
        Long photocardId = insertPhotocardOwnedBy(sellerId);
        Long auctionId = insertAuctionWithDevice(photocardId, sellerId, SELLER_DEVICE);
        auctionService.placeBid(alt, auctionId, new NftBidRequest(2_000L), SELLER_DEVICE);
        jdbcTemplate.update("UPDATE nft_auctions SET ends_at = now() - interval '1 second' WHERE id = ?", auctionId);
        closer.close(auctionId);
        Long tradeId = tradeIdOf(auctionId);
        writer.screen(tradeId);
        Long reviewId = reviewRepository.findByTradeId(tradeId).orElseThrow().getId();

        reviewService.approve(admin, reviewId, "가족 공용 기기로 확인");

        assertThat(chainStatus(tradeId)).isEqualTo("PENDING");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT risk_screened_at FROM nft_photocard_trades WHERE id = ?", java.sql.Timestamp.class, tradeId))
                .isNotNull();
        assertThat(writer.command(tradeId).needsRiskScreening()).isFalse();
        assertThat(writer.screen(tradeId)).isFalse();
        assertThat(auctionStatus(auctionId)).isEqualTo("SETTLING");
        assertThat(holdStatus("NFT_TRADE_SELLER", tradeId)).isEqualTo("ACTIVE");
    }

    @Test
    void 정상_거래는_심사_시각만_찍고_체인_전송으로_간다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        insertWallet(sellerId); // 정산 명령(writer.command)이 판매자 지갑을 조회한다
        Long buyer = insertFundedUser("b@test.com", "구매자", 10_000);
        distinctPhones(sellerId, buyer);
        Long photocardId = insertPhotocardOwnedBy(sellerId);
        Long auctionId = insertAuctionWithDevice(photocardId, sellerId, SELLER_DEVICE);
        auctionService.placeBid(buyer, auctionId, new NftBidRequest(2_000L), OTHER_DEVICE);
        jdbcTemplate.update("UPDATE nft_auctions SET ends_at = now() - interval '1 second' WHERE id = ?", auctionId);
        closer.close(auctionId);
        Long tradeId = tradeIdOf(auctionId);

        assertThat(writer.screen(tradeId)).isFalse();

        assertThat(chainStatus(tradeId)).isEqualTo("PENDING");
        assertThat(writer.command(tradeId).needsRiskScreening()).isFalse();
        assertThat(reviewRepository.findByTradeId(tradeId)).isEmpty();
    }

    @Test
    void 고정가_구매도_같은_자리에서_심사된다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        insertWallet(sellerId); // 정산 명령(writer.command)이 판매자 지갑을 조회한다
        Long alt = insertFundedUser("alt@test.com", "부계정", 10_000);
        distinctPhones(sellerId, alt);
        Long photocardId = insertPhotocardOwnedBy(sellerId);
        nftService.registerListing(sellerId, photocardId, new NftListingCreateRequest(3_000L, "급처"), SELLER_DEVICE);

        var purchase = nftService.purchase(alt, photocardId, UUID.randomUUID().toString(), SELLER_DEVICE);

        assertThat(writer.screen(purchase.tradeId())).isTrue();
        assertThat(chainStatus(purchase.tradeId())).isEqualTo("RISK_REVIEW");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT status::text FROM nft_photocard_listings WHERE photocard_id = ?", String.class, photocardId))
                .isEqualTo("SETTLING");
        assertThat(holdStatus("NFT_TRADE_BUYER", purchase.tradeId())).isEqualTo("ACTIVE");
    }

    @Test
    void 관리자_API_는_ADMIN_만_열리고_목록_상세_결정이_동작한다() throws Exception {
        Long sellerId = insertUser("s@test.com", "판매자");
        insertWallet(sellerId); // 정산 명령(writer.command)이 판매자 지갑을 조회한다
        Long alt = insertFundedUser("alt@test.com", "부계정", 10_000);
        Long admin = insertUser("admin@test.com", "관리자", "ADMIN");
        distinctPhones(sellerId, alt, admin);
        Long photocardId = insertPhotocardOwnedBy(sellerId);
        Long auctionId = insertAuctionWithDevice(photocardId, sellerId, SELLER_DEVICE);
        auctionService.placeBid(alt, auctionId, new NftBidRequest(2_000L), SELLER_DEVICE);
        jdbcTemplate.update("UPDATE nft_auctions SET ends_at = now() - interval '1 second' WHERE id = ?", auctionId);
        closer.close(auctionId);
        Long tradeId = tradeIdOf(auctionId);
        writer.screen(tradeId);
        Long reviewId = reviewRepository.findByTradeId(tradeId).orElseThrow().getId();

        mockMvc.perform(get("/admin/nft/trade-reviews")
                        .header(HttpHeaders.AUTHORIZATION, bearer(alt, UserRole.USER)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/admin/nft/trade-reviews").param("status", "OPEN")
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin, UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.reviews[0].reviewId").value(reviewId))
                .andExpect(jsonPath("$.data.reviews[0].maxSeverity").value("HIGH"))
                .andExpect(jsonPath("$.data.reviews[0].rules[0]").value(TradeRiskSameDeviceRule.CODE));

        mockMvc.perform(get("/admin/nft/trade-reviews/" + reviewId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin, UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sameIp").value(true))
                .andExpect(jsonPath("$.data.sameUserAgent").value(true))
                .andExpect(jsonPath("$.data.bids[0].sameDeviceAsSeller").value(true))
                .andExpect(jsonPath("$.data.seller.userId").value(sellerId))
                .andExpect(jsonPath("$.data.buyer.userId").value(alt));

        mockMvc.perform(post("/admin/nft/trade-reviews/" + reviewId + "/reject")
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin, UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"note\":\"같은 기기\"}"))
                .andExpect(status().isOk());
        assertThat(chainStatus(tradeId)).isEqualTo("FAILED");

        // 🔴 필터 없는 전체 조회 — 빈 IN () 로 500 이 났던 자리다. 상태별만 보면 못 잡는다
        mockMvc.perform(get("/admin/nft/trade-reviews/trades").param("status", "ALL")
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin, UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.trades[0].tradeId").value(tradeId));

        // 파라미터를 아예 생략해도 기본값(ALL)으로 같은 결과여야 한다
        mockMvc.perform(get("/admin/nft/trade-reviews/trades")
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin, UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1));

        mockMvc.perform(get("/admin/nft/trade-reviews/trades").param("status", "FAILED")
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin, UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.trades[0].tradeId").value(tradeId))
                .andExpect(jsonPath("$.data.trades[0].chainStatus").value("FAILED"))
                .andExpect(jsonPath("$.data.trades[0].failureCode").value("RISK_REJECTED"))
                .andExpect(jsonPath("$.data.trades[0].reviewId").value(reviewId))
                .andExpect(jsonPath("$.data.trades[0].reviewDecision").value("REJECTED"));

        mockMvc.perform(get("/admin/nft/trade-reviews/stats")
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin, UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviews").value(1))
                .andExpect(jsonPath("$.data.rejected").value(1))
                .andExpect(jsonPath("$.data.open").value(0));
    }

    private Long insertAuctionWithDevice(Long photocardId, Long sellerId, ClientRequest device) {
        Long auctionId = insertAuction(photocardId, sellerId, 1_000, null, "now() + interval '1 day'");
        jdbcTemplate.update("UPDATE nft_auctions SET client_ip = ?, user_agent_hash = ? WHERE id = ?",
                device.ip(), device.userAgentHash(), auctionId);
        return auctionId;
    }

    /** 기본 픽스처는 전화번호가 전부 같다(R2 에 걸린다). 시나리오가 원하는 규칙만 걸리도록 번호를 갈라 준다 */
    private void distinctPhones(Long... userIds) {
        for (Long userId : userIds) {
            jdbcTemplate.update("UPDATE users SET phone = ? WHERE id = ?", "010-%04d-%04d".formatted(userId, userId), userId);
        }
    }

    private Long tradeIdOf(Long auctionId) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM nft_photocard_trades WHERE auction_id = ?", Long.class, auctionId);
    }

    private String chainStatus(Long tradeId) {
        return jdbcTemplate.queryForObject(
                "SELECT chain_status::text FROM nft_photocard_trades WHERE id = ?", String.class, tradeId);
    }

    private String auctionStatus(Long auctionId) {
        return jdbcTemplate.queryForObject(
                "SELECT status::text FROM nft_auctions WHERE id = ?", String.class, auctionId);
    }

    private Long ownerOf(Long photocardId) {
        return jdbcTemplate.queryForObject(
                "SELECT owner_id FROM nft_photocards WHERE id = ?", Long.class, photocardId);
    }

    private String holdStatus(String refType, Long refId) {
        return jdbcTemplate.queryForObject(
                "SELECT status::text FROM cat_money_holds WHERE ref_type = ?::cat_money_hold_ref_type AND ref_id = ?",
                String.class, refType, refId);
    }

    private String bearer(Long userId, UserRole role) {
        return "Bearer " + jwtTokenProvider.createAccessToken(userId, role);
    }
}
