package com.teacat.server.nft.repository;

import com.teacat.server.nft.dto.request.NftAuctionSort;
import com.teacat.server.nft.entity.NftAuctionStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 경매 화면용 조회 (native SQL). 쓰기는 하지 않는다.
 * 목록은 전부 keyset 커서다 — 정렬 키와 id 를 함께 비교해 같은 값에서도 빠지거나 겹치지 않는다.
 */
@Repository
@RequiredArgsConstructor
public class NftAuctionQueryRepository {

    private static final String AUCTION_SELECT = """
            SELECT a.id AS auction_id, p.id AS photocard_id, d.name AS design_name, d.image_url,
                   pg.title AS performance_title, seller.nickname AS seller_nickname,
                   a.start_price, a.current_price, a.buy_now_price, a.bid_count, a.ends_at, a.created_at,
                   a.status::text AS status, a.closed_at, winner.nickname AS winner_nickname
              FROM nft_auctions a
              JOIN nft_photocards p ON p.id = a.photocard_id
              JOIN nft_photocard_designs d ON d.id = p.design_id
              JOIN performance_general pg ON pg.id = d.performance_general_id
              JOIN users seller ON seller.id = a.seller_id
              LEFT JOIN users winner ON winner.id = a.winner_id
            """;

    private static final RowMapper<AuctionRow> AUCTION_ROW = (rs, rowNum) -> new AuctionRow(
            rs.getLong("auction_id"),
            rs.getLong("photocard_id"),
            rs.getString("design_name"),
            rs.getString("image_url"),
            rs.getString("performance_title"),
            rs.getString("seller_nickname"),
            rs.getLong("start_price"),
            rs.getLong("current_price"),
            (Long) rs.getObject("buy_now_price"),
            rs.getInt("bid_count"),
            rs.getObject("ends_at", LocalDateTime.class),
            rs.getObject("created_at", LocalDateTime.class),
            NftAuctionStatus.valueOf(rs.getString("status")),
            rs.getObject("closed_at", LocalDateTime.class),
            rs.getString("winner_nickname")
    );

    private final NamedParameterJdbcTemplate jdbcTemplate;

    /**
     * DB 의 현재 시각. 마감 시각을 이 값으로 계산해야 마감 판정(ends_at <= now())과 같은 시계를 쓴다.
     * ::timestamp 로 세션 타임존 기준 naive 값으로 받아 ends_at(timestamp) 과 같은 타입을 맞춘다.
     */
    public LocalDateTime currentTime() {
        return jdbcTemplate.queryForObject("SELECT now()::timestamp", new MapSqlParameterSource(), LocalDateTime.class);
    }

    /**
     * 진행 중 경매 목록.
     *
     * @param cursorValue 정렬 키의 커서값 — ENDING_SOON/RECENT 는 LocalDateTime 문자열, CURRENT_PRICE 는 숫자 문자열. 첫 페이지면 null
     */
    public List<AuctionRow> findActiveAuctions(Long performanceId, String keyword, NftAuctionSort sort,
                                               String cursorValue, Long cursorId, int limit) {
        // 마감 시각이 지났는데 스위퍼가 아직 안 닫은 경매는 "진행 중" 이 아니다. 카운트다운이 음수로 보이면 안 된다
        StringBuilder sql = new StringBuilder(AUCTION_SELECT)
                .append(" WHERE a.status = 'ACTIVE' AND a.ends_at > now()");
        MapSqlParameterSource params = new MapSqlParameterSource("limit", limit);

        if (performanceId != null) {
            sql.append(" AND d.performance_general_id = :performanceId");
            params.addValue("performanceId", performanceId);
        }
        if (keyword != null) {
            sql.append(" AND d.name ILIKE :keyword");
            params.addValue("keyword", '%' + escapeLike(keyword) + '%');
        }
        if (cursorValue != null) {
            params.addValue("cursorId", cursorId);
            switch (sort) {
                case ENDING_SOON -> {
                    sql.append(" AND (a.ends_at, a.id) > (:cursorAt, :cursorId)");
                    params.addValue("cursorAt", LocalDateTime.parse(cursorValue));
                }
                case CURRENT_PRICE -> {
                    sql.append(" AND (a.current_price, a.id) > (:cursorPrice, :cursorId)");
                    params.addValue("cursorPrice", Long.parseLong(cursorValue));
                }
                case RECENT -> {
                    sql.append(" AND (a.created_at, a.id) < (:cursorAt, :cursorId)");
                    params.addValue("cursorAt", LocalDateTime.parse(cursorValue));
                }
            }
        }
        sql.append(switch (sort) {
            case ENDING_SOON -> " ORDER BY a.ends_at, a.id";
            case CURRENT_PRICE -> " ORDER BY a.current_price, a.id";
            case RECENT -> " ORDER BY a.created_at DESC, a.id DESC";
        });
        sql.append(" LIMIT :limit");
        return jdbcTemplate.query(sql.toString(), params, AUCTION_ROW);
    }

    /** 내가 올린 경매. 최근 등록순 */
    public List<AuctionRow> findMyAuctions(Long sellerId, NftAuctionStatus status,
                                           LocalDateTime cursorAt, Long cursorId, int limit) {
        StringBuilder sql = new StringBuilder(AUCTION_SELECT).append(" WHERE a.seller_id = :sellerId");
        MapSqlParameterSource params = new MapSqlParameterSource("sellerId", sellerId).addValue("limit", limit);
        if (status != null) {
            sql.append(" AND a.status = CAST(:status AS nft_auction_status)");
            params.addValue("status", status.name());
        }
        if (cursorAt != null) {
            sql.append(" AND (a.created_at, a.id) < (:cursorAt, :cursorId)");
            params.addValue("cursorAt", cursorAt).addValue("cursorId", cursorId);
        }
        sql.append(" ORDER BY a.created_at DESC, a.id DESC LIMIT :limit");
        return jdbcTemplate.query(sql.toString(), params, AUCTION_ROW);
    }

    public Optional<AuctionDetailRow> findAuctionDetail(Long auctionId) {
        String sql = """
                SELECT a.id AS auction_id, a.status::text AS status, p.id AS photocard_id, d.name AS design_name,
                       d.image_url, pg.title AS performance_title, a.seller_id, seller.nickname AS seller_nickname,
                       a.start_price, a.current_price, a.buy_now_price, a.bid_count,
                       tb.bidder_id AS top_bidder_id, top_bidder.nickname AS top_bidder_nickname,
                       a.created_at, a.ends_at, a.closed_at, winner.nickname AS winner_nickname
                  FROM nft_auctions a
                  JOIN nft_photocards p ON p.id = a.photocard_id
                  JOIN nft_photocard_designs d ON d.id = p.design_id
                  JOIN performance_general pg ON pg.id = d.performance_general_id
                  JOIN users seller ON seller.id = a.seller_id
                  LEFT JOIN nft_auction_bids tb ON tb.id = a.top_bid_id
                  LEFT JOIN users top_bidder ON top_bidder.id = tb.bidder_id
                  LEFT JOIN users winner ON winner.id = a.winner_id
                 WHERE a.id = :auctionId
                """;
        List<AuctionDetailRow> rows = jdbcTemplate.query(sql, new MapSqlParameterSource("auctionId", auctionId),
                (rs, rowNum) -> new AuctionDetailRow(
                        rs.getLong("auction_id"),
                        NftAuctionStatus.valueOf(rs.getString("status")),
                        rs.getLong("photocard_id"),
                        rs.getString("design_name"),
                        rs.getString("image_url"),
                        rs.getString("performance_title"),
                        rs.getLong("seller_id"),
                        rs.getString("seller_nickname"),
                        rs.getLong("start_price"),
                        rs.getLong("current_price"),
                        (Long) rs.getObject("buy_now_price"),
                        rs.getInt("bid_count"),
                        (Long) rs.getObject("top_bidder_id"),
                        rs.getString("top_bidder_nickname"),
                        rs.getObject("created_at", LocalDateTime.class),
                        rs.getObject("ends_at", LocalDateTime.class),
                        rs.getObject("closed_at", LocalDateTime.class),
                        rs.getString("winner_nickname")
                ));
        return rows.stream().findFirst();
    }

    /** 입찰 이력. 최신순, 커서는 입찰 id */
    public List<BidRow> findBids(Long auctionId, Long cursorId, int limit) {
        StringBuilder sql = new StringBuilder("""
                SELECT b.id AS bid_id, u.nickname AS bidder_nickname, b.amount, b.created_at
                  FROM nft_auction_bids b
                  JOIN users u ON u.id = b.bidder_id
                 WHERE b.auction_id = :auctionId
                """);
        MapSqlParameterSource params = new MapSqlParameterSource("auctionId", auctionId).addValue("limit", limit);
        if (cursorId != null) {
            sql.append(" AND b.id < :cursorId");
            params.addValue("cursorId", cursorId);
        }
        sql.append(" ORDER BY b.id DESC LIMIT :limit");
        return jdbcTemplate.query(sql.toString(), params, (rs, rowNum) -> new BidRow(
                rs.getLong("bid_id"),
                rs.getString("bidder_nickname"),
                rs.getLong("amount"),
                rs.getObject("created_at", LocalDateTime.class)
        ));
    }

    /**
     * 내가 입찰한 경매. 경매 단위로 묶고 내 마지막 입찰(id) 내림차순 — 입찰 id 는 시간 순으로 증가하므로 시각 대신 쓴다.
     *
     * @param cursorLastBidId 직전 페이지 마지막 항목의 lastBidId. 첫 페이지면 null
     */
    public List<MyBidRow> findMyBids(Long userId, Long cursorLastBidId, int limit) {
        StringBuilder sql = new StringBuilder("""
                SELECT a.id AS auction_id, p.id AS photocard_id, d.name AS design_name, d.image_url,
                       mb.my_highest, mb.last_bid_id, a.current_price, tb.bidder_id AS top_bidder_id,
                       a.status::text AS status, a.ends_at, a.winner_id
                  FROM (SELECT auction_id, MAX(amount) AS my_highest, MAX(id) AS last_bid_id
                          FROM nft_auction_bids
                         WHERE bidder_id = :userId
                         GROUP BY auction_id) mb
                  JOIN nft_auctions a ON a.id = mb.auction_id
                  JOIN nft_photocards p ON p.id = a.photocard_id
                  JOIN nft_photocard_designs d ON d.id = p.design_id
                  LEFT JOIN nft_auction_bids tb ON tb.id = a.top_bid_id
                """);
        MapSqlParameterSource params = new MapSqlParameterSource("userId", userId).addValue("limit", limit);
        if (cursorLastBidId != null) {
            sql.append(" WHERE mb.last_bid_id < :cursorLastBidId");
            params.addValue("cursorLastBidId", cursorLastBidId);
        }
        sql.append(" ORDER BY mb.last_bid_id DESC LIMIT :limit");
        return jdbcTemplate.query(sql.toString(), params, (rs, rowNum) -> new MyBidRow(
                rs.getLong("auction_id"),
                rs.getLong("photocard_id"),
                rs.getString("design_name"),
                rs.getString("image_url"),
                rs.getLong("my_highest"),
                rs.getLong("last_bid_id"),
                rs.getLong("current_price"),
                (Long) rs.getObject("top_bidder_id"),
                NftAuctionStatus.valueOf(rs.getString("status")),
                rs.getObject("ends_at", LocalDateTime.class),
                (Long) rs.getObject("winner_id")
        ));
    }

    /** 포토카드 상세에 붙일 진행 중 경매 요약 */
    public Optional<AuctionSummaryRow> findActiveAuctionSummary(Long photocardId) {
        String sql = """
                SELECT id, current_price, buy_now_price, bid_count, ends_at
                  FROM nft_auctions
                 WHERE photocard_id = :photocardId AND status = 'ACTIVE'
                """;
        return jdbcTemplate.query(sql, new MapSqlParameterSource("photocardId", photocardId),
                (rs, rowNum) -> new AuctionSummaryRow(
                        rs.getLong("id"),
                        rs.getLong("current_price"),
                        (Long) rs.getObject("buy_now_price"),
                        rs.getInt("bid_count"),
                        rs.getObject("ends_at", LocalDateTime.class)
                )).stream().findFirst();
    }

    private String escapeLike(String keyword) {
        return keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    public record AuctionRow(Long auctionId, Long photocardId, String designName, String imageUrl,
                             String performanceTitle, String sellerNickname, Long startPrice, Long currentPrice,
                             Long buyNowPrice, int bidCount, LocalDateTime endsAt, LocalDateTime createdAt,
                             NftAuctionStatus status, LocalDateTime closedAt, String winnerNickname) {
    }

    public record AuctionDetailRow(Long auctionId, NftAuctionStatus status, Long photocardId, String designName,
                                   String imageUrl, String performanceTitle, Long sellerId, String sellerNickname,
                                   Long startPrice, Long currentPrice, Long buyNowPrice, int bidCount,
                                   Long topBidderId, String topBidderNickname, LocalDateTime createdAt,
                                   LocalDateTime endsAt, LocalDateTime closedAt, String winnerNickname) {
    }

    public record BidRow(Long bidId, String bidderNickname, Long amount, LocalDateTime bidAt) {
    }

    public record MyBidRow(Long auctionId, Long photocardId, String designName, String imageUrl,
                           Long myHighestBid, Long lastBidId, Long currentPrice, Long topBidderId,
                           NftAuctionStatus status, LocalDateTime endsAt, Long winnerId) {
    }

    public record AuctionSummaryRow(Long auctionId, Long currentPrice, Long buyNowPrice, int bidCount,
                                    LocalDateTime endsAt) {
    }
}
