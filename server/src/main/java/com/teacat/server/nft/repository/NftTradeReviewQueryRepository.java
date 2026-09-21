package com.teacat.server.nft.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 관리자 심사 화면용 조회 (native SQL). 쓰기는 하지 않는다 */
@Repository
@RequiredArgsConstructor
public class NftTradeReviewQueryRepository {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    /** 경매의 입찰 이력(시간순). 단말은 판매자 단말과 비교하기 위해 함께 준다 */
    public List<BidRow> findBids(Long auctionId) {
        return jdbcTemplate.query("""
                SELECT b.id, b.bidder_id, u.nickname, b.amount, b.created_at, b.client_ip, b.user_agent_hash
                  FROM nft_auction_bids b
                  JOIN users u ON u.id = b.bidder_id
                 WHERE b.auction_id = :auctionId
                 ORDER BY b.created_at ASC, b.id ASC
                """, Map.of("auctionId", auctionId), (rs, i) -> new BidRow(
                rs.getLong("id"), rs.getLong("bidder_id"), rs.getString("nickname"), rs.getLong("amount"),
                rs.getObject("created_at", LocalDateTime.class), rs.getString("client_ip"),
                rs.getString("user_agent_hash")));
    }

    /** 같은 도안의 최근 완료 거래(최신순) */
    public List<RecentTradeRow> findRecentDesignTrades(Long designId, Long excludeTradeId, int limit) {
        return jdbcTemplate.query("""
                SELECT t.id, t.price, t.completed_at, t.seller_id, t.buyer_id
                  FROM nft_photocard_trades t
                  JOIN nft_photocards p ON p.id = t.photocard_id
                 WHERE p.design_id = :designId AND t.chain_status = 'COMPLETED' AND t.id <> :excludeTradeId
                 ORDER BY t.completed_at DESC, t.id DESC
                 LIMIT :limit
                """, new MapSqlParameterSource().addValue("designId", designId)
                        .addValue("excludeTradeId", excludeTradeId).addValue("limit", limit),
                (rs, i) -> new RecentTradeRow(rs.getLong("id"), rs.getLong("price"),
                        rs.getObject("completed_at", LocalDateTime.class), rs.getLong("seller_id"), rs.getLong("buyer_id")));
    }

    public long countTradesCreatedSince(LocalDateTime since) {
        Long count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nft_photocard_trades WHERE created_at >= :since",
                Map.of("since", since), Long.class);
        return count == null ? 0 : count;
    }

    /** 기간 안 열린 심사의 결정별 수 */
    public DecisionCounts countDecisionsSince(LocalDateTime since) {
        return jdbcTemplate.queryForObject("""
                SELECT count(*) AS total,
                       count(*) FILTER (WHERE decision = 'APPROVED' AND decided_by IS NOT NULL) AS approved,
                       count(*) FILTER (WHERE decision = 'REJECTED') AS rejected,
                       count(*) FILTER (WHERE decision = 'APPROVED' AND decided_by IS NULL) AS auto_approved
                  FROM nft_trade_reviews
                 WHERE created_at >= :since
                """, Map.of("since", since), (rs, i) -> new DecisionCounts(
                rs.getLong("total"), rs.getLong("approved"), rs.getLong("rejected"), rs.getLong("auto_approved")));
    }

    /** 기간 안 열린 심사에서 규칙별 적중 수. 한 심사의 signals 배열을 풀어 센다 */
    public Map<String, Long> countRuleHitsSince(LocalDateTime since) {
        Map<String, Long> hits = new LinkedHashMap<>();
        jdbcTemplate.query("""
                SELECT s ->> 'rule' AS rule, count(*) AS hits
                  FROM nft_trade_reviews r, jsonb_array_elements(r.signals) s
                 WHERE r.created_at >= :since
                 GROUP BY 1
                 ORDER BY 1
                """, Map.of("since", since), rs -> {
            hits.put(rs.getString("rule"), rs.getLong("hits"));
        });
        return hits;
    }

    /**
     * 상태 필터를 WHERE 조건 문자열로 만든다.
     *
     * <p>🔴 <b>빈 목록을 {@code IN (:statuses)} 에 넘기면 안 된다.</b> 바인딩이 {@code IN ()} 가 되어
     * SQL 문법 오류로 죽는다 — 전체 조회(필터 없음)가 통째로 500 이 됐던 원인이다.
     * 조건 자체를 빼야 한다. 파라미터는 조건을 쓸 때만 넣는다.
     */
    private static String statusFilter(List<String> statuses, MapSqlParameterSource params) {
        if (statuses == null || statuses.isEmpty()) {
            return "TRUE";
        }
        params.addValue("statuses", statuses);
        return "t.chain_status::text IN (:statuses)";
    }

    /**
     * 관리자 거래 내역 — 경로·상태 무관하게 모든 거래를 최신순으로. 심사 행이 있으면 함께 붙인다.
     *
     * @param statuses null 이거나 비어 있으면 전부, 아니면 이 체인 상태들만
     */
    public List<TradeRow> findTrades(List<String> statuses, int offset, int limit) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("offset", offset).addValue("limit", limit);
        String filter = statusFilter(statuses, params);
        return jdbcTemplate.query("""
                SELECT t.id, t.auction_id, t.listing_id, t.photocard_id, d.name AS design_name, d.image_url,
                       t.seller_id, s.nickname AS seller_nickname, t.buyer_id, b.nickname AS buyer_nickname,
                       t.price, t.chain_status::text AS chain_status, t.failure_code, t.created_at, t.completed_at,
                       r.id AS review_id, r.decision::text AS review_decision, r.max_severity::text AS review_severity, r.held AS review_held
                  FROM nft_photocard_trades t
                  JOIN nft_photocards p ON p.id = t.photocard_id
                  JOIN nft_photocard_designs d ON d.id = p.design_id
                  JOIN users s ON s.id = t.seller_id
                  JOIN users b ON b.id = t.buyer_id
                  LEFT JOIN nft_trade_reviews r ON r.trade_id = t.id
                 WHERE %s
                 ORDER BY t.created_at DESC, t.id DESC
                 OFFSET :offset LIMIT :limit
                """.formatted(filter), params, (rs, i) -> new TradeRow(
                rs.getLong("id"), (Long) rs.getObject("auction_id"), (Long) rs.getObject("listing_id"),
                rs.getLong("photocard_id"), rs.getString("design_name"), rs.getString("image_url"),
                rs.getLong("seller_id"), rs.getString("seller_nickname"),
                rs.getLong("buyer_id"), rs.getString("buyer_nickname"),
                rs.getLong("price"), rs.getString("chain_status"), rs.getString("failure_code"),
                rs.getObject("created_at", LocalDateTime.class), rs.getObject("completed_at", LocalDateTime.class),
                (Long) rs.getObject("review_id"), rs.getString("review_decision"), rs.getString("review_severity"),
                rs.getObject("review_held") == null ? null : rs.getBoolean("review_held")));
    }

    public long countTrades(List<String> statuses) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        String filter = statusFilter(statuses, params);
        Long count = jdbcTemplate.queryForObject("""
                SELECT count(*) FROM nft_photocard_trades t WHERE %s
                """.formatted(filter), params, Long.class);
        return count == null ? 0 : count;
    }

    public record BidRow(Long bidId, Long bidderId, String nickname, Long amount, LocalDateTime createdAt,
                         String clientIp, String userAgentHash) {}

    public record TradeRow(Long tradeId, Long auctionId, Long listingId, Long photocardId, String designName,
                           String imageUrl, Long sellerId, String sellerNickname, Long buyerId, String buyerNickname,
                           Long price, String chainStatus, String failureCode, LocalDateTime createdAt,
                           LocalDateTime completedAt, Long reviewId, String reviewDecision, String reviewSeverity,
                           Boolean reviewHeld) {}

    public record RecentTradeRow(Long tradeId, Long price, LocalDateTime completedAt, Long sellerId, Long buyerId) {}

    public record DecisionCounts(long total, long approved, long rejected, long autoApproved) {}
}
