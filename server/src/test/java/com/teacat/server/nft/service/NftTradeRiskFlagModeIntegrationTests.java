package com.teacat.server.nft.service;

import com.teacat.server.auth.security.ClientRequest;
import com.teacat.server.auth.security.JwtTokenProvider;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.NftBidRequest;
import com.teacat.server.nft.entity.NftReviewDecision;
import com.teacat.server.nft.entity.NftReviewSeverity;
import com.teacat.server.nft.entity.NftTradeReview;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftTradeReviewRepository;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 표시(FLAG) 모드 — 기본값. 규칙에 걸려도 정산은 그대로 가고 심사 행만 남는다 (AUCTION_FRAUD_DESIGN.md 2장 mode).
 * 관리자 결정은 돈을 움직이지 않고 "정상·부정" 판정으로 기록만 된다. 이 기록이 학습 라벨이다.
 */
class NftTradeRiskFlagModeIntegrationTests extends PostgresIntegrationTest {

    private static final ClientRequest SELLER_DEVICE = ClientRequest.of("10.0.0.7", "Mozilla/5.0 (seller)");
    private static final ClientRequest SAME_IP_OTHER_BROWSER = ClientRequest.of("10.0.0.7", "Mozilla/5.0 (other)");

    @Override
    protected Long insertPhotocardOwnedBy(Long ownerId) {
        Long photocardId = super.insertPhotocardOwnedBy(ownerId);
        jdbcTemplate.update("UPDATE nft_photocards SET status = 'MINTED' WHERE id = ?", photocardId);
        return photocardId;
    }

    @Autowired private NftAuctionService auctionService;
    @Autowired private NftAuctionCloser closer;
    @Autowired private NftTradeSettlementWriter writer;
    @Autowired private NftTradeReviewService reviewService;
    @Autowired private NftTradeReviewRepository reviewRepository;
    @Autowired private MockMvc mockMvc;
    @Autowired private JwtTokenProvider jwtTokenProvider;

    @Test
    void 걸려도_정산은_그대로_가고_심사_행만_남는다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        insertWallet(sellerId);
        Long alt = insertFundedUser("alt@test.com", "부계정", 10_000);
        distinctPhones(sellerId, alt);
        Long auctionId = insertAuctionWithDevice(insertPhotocardOwnedBy(sellerId), sellerId, SELLER_DEVICE);
        var top = auctionService.placeBid(alt, auctionId, new NftBidRequest(2_000L), SELLER_DEVICE);
        jdbcTemplate.update("UPDATE nft_auctions SET ends_at = now() - interval '1 second' WHERE id = ?", auctionId);
        closer.close(auctionId);
        Long tradeId = tradeIdOf(auctionId);

        boolean held = writer.screen(tradeId);

        // 정산은 멈추지 않는다 — PENDING 그대로, 심사 시각이 찍혀 다음 단계(체인 전송)로 간다
        assertThat(held).isFalse();
        assertThat(chainStatus(tradeId)).isEqualTo("PENDING");
        assertThat(writer.command(tradeId).needsRiskScreening()).isFalse();
        assertThat(holdStatus("AUCTION_BID", top.bidId())).isEqualTo("ACTIVE");
        // 그래도 데이터는 남는다
        NftTradeReview review = reviewRepository.findByTradeId(tradeId).orElseThrow();
        assertThat(review.isFlagged()).isTrue();
        assertThat(review.isHeld()).isFalse();
        assertThat(review.getMaxSeverity()).isEqualTo(NftReviewSeverity.HIGH);
        assertThat(review.getSignals()).anyMatch(s -> s.rule().equals(TradeRiskSameDeviceRule.CODE));
    }

    @Test
    void 기준_미달_신호_하나도_기록은_남고_flagged_는_false_다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        insertWallet(sellerId);
        Long buyer = insertFundedUser("b@test.com", "구매자", 10_000);
        distinctPhones(sellerId, buyer);
        Long auctionId = insertAuctionWithDevice(insertPhotocardOwnedBy(sellerId), sellerId, SELLER_DEVICE);
        auctionService.placeBid(buyer, auctionId, new NftBidRequest(2_000L), SAME_IP_OTHER_BROWSER); // R1 MEDIUM 하나
        jdbcTemplate.update("UPDATE nft_auctions SET ends_at = now() - interval '1 second' WHERE id = ?", auctionId);
        closer.close(auctionId);
        Long tradeId = tradeIdOf(auctionId);

        assertThat(writer.screen(tradeId)).isFalse();

        NftTradeReview review = reviewRepository.findByTradeId(tradeId).orElseThrow();
        assertThat(review.isFlagged()).isFalse();
        assertThat(review.isHeld()).isFalse();
        assertThat(review.getMaxSeverity()).isEqualTo(NftReviewSeverity.MEDIUM);
    }

    @Test
    void 관리자_판정은_기록만_남기고_거래와_홀드를_건드리지_않는다() throws Exception {
        Long sellerId = insertUser("s@test.com", "판매자");
        insertWallet(sellerId);
        Long alt = insertFundedUser("alt@test.com", "부계정", 10_000);
        Long admin = insertUser("admin@test.com", "관리자", "ADMIN");
        distinctPhones(sellerId, alt, admin);
        Long auctionId = insertAuctionWithDevice(insertPhotocardOwnedBy(sellerId), sellerId, SELLER_DEVICE);
        var top = auctionService.placeBid(alt, auctionId, new NftBidRequest(2_000L), SELLER_DEVICE);
        jdbcTemplate.update("UPDATE nft_auctions SET ends_at = now() - interval '1 second' WHERE id = ?", auctionId);
        closer.close(auctionId);
        Long tradeId = tradeIdOf(auctionId);
        writer.screen(tradeId);
        Long reviewId = reviewRepository.findByTradeId(tradeId).orElseThrow().getId();

        // 목록에는 뜨고, 시한(자동 승인)은 없다
        mockMvc.perform(get("/admin/nft/trade-reviews").param("status", "OPEN")
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.reviews[0].held").value(false))
                .andExpect(jsonPath("$.data.reviews[0].flagged").value(true))
                .andExpect(jsonPath("$.data.reviews[0].autoApproveAt").doesNotExist());

        // 부정 판정 — 사유 필수, 거래·홀드는 그대로
        assertThatThrownBy(() -> reviewService.reject(admin, reviewId, ""))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(NftErrorCode.TRADE_REVIEW_NOTE_REQUIRED);
        reviewService.reject(admin, reviewId, "같은 기기에서 입찰");

        NftTradeReview review = reviewRepository.findById(reviewId).orElseThrow();
        assertThat(review.getDecision()).isEqualTo(NftReviewDecision.REJECTED);
        assertThat(review.getDecidedBy()).isEqualTo(admin);
        assertThat(chainStatus(tradeId)).isEqualTo("PENDING");
        assertThat(holdStatus("AUCTION_BID", top.bidId())).isEqualTo("ACTIVE");
        assertThat(auctionStatus(auctionId)).isEqualTo("SETTLING");

        // 시한 자동 승인 대상이 아니다
        assertThat(reviewService.autoApproveExpired(10)).isZero();
    }

    @Test
    void 정상_판정도_기록만_남는다() {
        Long sellerId = insertUser("s@test.com", "판매자");
        insertWallet(sellerId);
        Long alt = insertFundedUser("alt@test.com", "부계정", 10_000);
        Long admin = insertUser("admin@test.com", "관리자", "ADMIN");
        distinctPhones(sellerId, alt, admin);
        Long auctionId = insertAuctionWithDevice(insertPhotocardOwnedBy(sellerId), sellerId, SELLER_DEVICE);
        auctionService.placeBid(alt, auctionId, new NftBidRequest(2_000L), SELLER_DEVICE);
        jdbcTemplate.update("UPDATE nft_auctions SET ends_at = now() - interval '1 second' WHERE id = ?", auctionId);
        closer.close(auctionId);
        Long tradeId = tradeIdOf(auctionId);
        writer.screen(tradeId);
        Long reviewId = reviewRepository.findByTradeId(tradeId).orElseThrow().getId();

        reviewService.approve(admin, reviewId, "가족 공용 기기");

        NftTradeReview review = reviewRepository.findById(reviewId).orElseThrow();
        assertThat(review.getDecision()).isEqualTo(NftReviewDecision.APPROVED);
        assertThat(chainStatus(tradeId)).isEqualTo("PENDING");
        assertThatThrownBy(() -> reviewService.reject(admin, reviewId, "다시"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(NftErrorCode.TRADE_REVIEW_ALREADY_DECIDED);
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

    private String holdStatus(String refType, Long refId) {
        return jdbcTemplate.queryForObject(
                "SELECT status::text FROM cat_money_holds WHERE ref_type = ?::cat_money_hold_ref_type AND ref_id = ?",
                String.class, refType, refId);
    }

    private String bearer(Long userId) {
        return "Bearer " + jwtTokenProvider.createAccessToken(userId, UserRole.ADMIN);
    }
}
