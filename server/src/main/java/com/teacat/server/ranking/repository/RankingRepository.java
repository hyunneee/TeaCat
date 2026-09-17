package com.teacat.server.ranking.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;

@Repository
@RequiredArgsConstructor
public class RankingRepository {

    private final JdbcClient jdbcClient;

    public List<ConcertRankRow> findPopularConcerts(LocalDateTime previousFrom,
                                                     LocalDateTime currentFrom,
                                                     LocalDateTime now) {
        return jdbcClient.sql("""
                WITH scores AS (
                    SELECT pg.id,
                           CASE WHEN pv.viewed_at >= :currentFrom THEN 'current' ELSE 'previous' END AS period,
                           count(*) AS view_count,
                           0::bigint AS paid_count
                      FROM performance_views pv
                      JOIN performance_general pg ON pg.id = pv.performance_general_id
                     WHERE pv.viewed_at >= :previousFrom AND pv.viewed_at < :now
                       AND pg.hidden_at IS NULL
                     GROUP BY pg.id, period
                    UNION ALL
                    SELECT pg.id,
                           CASE WHEN o.paid_at >= :currentFrom THEN 'current' ELSE 'previous' END AS period,
                           0::bigint,
                           count(*)
                      FROM ticket_orders o
                      JOIN performance_details pd ON pd.id = o.performance_detail_id
                      JOIN performance_general pg ON pg.id = pd.performance_general_id
                     WHERE o.status = 'PAID' AND o.paid_at >= :previousFrom AND o.paid_at < :now
                       AND pg.hidden_at IS NULL
                     GROUP BY pg.id, period
                ), totals AS (
                    SELECT id, period, sum(view_count + paid_count * 5) AS score,
                           sum(view_count) AS views, sum(paid_count) AS bookings
                      FROM scores GROUP BY id, period
                ), ranked AS (
                    SELECT id, period, score,
                           row_number() OVER (PARTITION BY period
                               ORDER BY score DESC, views DESC, bookings DESC, id DESC) AS rank
                      FROM totals
                )
                SELECT current.rank, previous.rank AS previous_rank, current.score,
                       pg.id, pg.title, pg.poster_img, s.name AS stadium_name
                  FROM ranked current
                  JOIN performance_general pg ON pg.id = current.id
                  JOIN stadiums s ON s.id = pg.stadium_id
                  LEFT JOIN ranked previous ON previous.id = current.id AND previous.period = 'previous'
                 WHERE current.period = 'current' AND current.rank <= 10
                 ORDER BY current.rank
                """)
                .param("previousFrom", previousFrom)
                .param("currentFrom", currentFrom)
                .param("now", now)
                .query((rs, rowNum) -> new ConcertRankRow(
                        rs.getInt("rank"), previousRank(rs),
                        rs.getLong("score"), rs.getLong("id"), rs.getString("title"),
                        rs.getString("stadium_name"), rs.getString("poster_img")))
                .list();
    }

    public List<PhotocardRankRow> findPopularPhotocards(LocalDateTime previousFrom,
                                                         LocalDateTime currentFrom,
                                                         LocalDateTime now) {
        return jdbcClient.sql("""
                WITH totals AS (
                    SELECT p.design_id,
                           CASE WHEN t.traded_at >= :currentFrom THEN 'current' ELSE 'previous' END AS period,
                           count(*) AS trade_count, sum(t.price) AS traded_amount, max(t.traded_at) AS latest_trade
                      FROM nft_photocard_trades t
                      JOIN nft_photocards p ON p.id = t.photocard_id
                     WHERE t.chain_status = 'COMPLETED'
                       AND t.traded_at >= :previousFrom AND t.traded_at < :now
                     GROUP BY p.design_id, period
                ), ranked AS (
                    SELECT *, row_number() OVER (PARTITION BY period
                         ORDER BY trade_count DESC, traded_amount DESC, latest_trade DESC, design_id DESC) AS rank
                      FROM totals
                )
                SELECT current.rank, previous.rank AS previous_rank,
                       current.trade_count, current.traded_amount, d.id AS design_id,
                       d.name, d.image_url, pg.title AS performance_title,
                       market.photocard_id, market.auction_id, market.market_type
                  FROM ranked current
                  JOIN nft_photocard_designs d ON d.id = current.design_id
                  LEFT JOIN performance_general pg ON pg.id = d.performance_general_id
                  JOIN LATERAL (
                       SELECT x.photocard_id, x.auction_id, x.market_type
                         FROM (
                              SELECT l.photocard_id, NULL::bigint AS auction_id,
                                     'FIXED'::text AS market_type, l.listed_at AS opened_at
                                FROM nft_photocard_listings l
                                JOIN nft_photocards p ON p.id = l.photocard_id
                               WHERE p.design_id = d.id AND l.status = 'ACTIVE'
                              UNION ALL
                              SELECT a.photocard_id, a.id, 'AUCTION'::text, a.created_at
                                FROM nft_auctions a
                                JOIN nft_photocards p ON p.id = a.photocard_id
                               WHERE p.design_id = d.id AND a.status = 'ACTIVE'
                         ) x ORDER BY x.opened_at DESC, x.photocard_id DESC LIMIT 1
                  ) market ON true
                  LEFT JOIN ranked previous ON previous.design_id = current.design_id
                                           AND previous.period = 'previous'
                 WHERE current.period = 'current' AND current.rank <= 10
                 ORDER BY current.rank
                """)
                .param("previousFrom", previousFrom)
                .param("currentFrom", currentFrom)
                .param("now", now)
                .query((rs, rowNum) -> new PhotocardRankRow(
                        rs.getInt("rank"), previousRank(rs),
                        rs.getLong("trade_count"), rs.getLong("traded_amount"),
                        rs.getLong("design_id"), rs.getString("name"), rs.getString("image_url"),
                        rs.getString("performance_title"), rs.getLong("photocard_id"),
                        (Long) rs.getObject("auction_id"), rs.getString("market_type")))
                .list();
    }

    /** row_number() 는 bigint 라 getObject() 는 Long 을 준다. previous 가 없으면 null. */
    private static Integer previousRank(java.sql.ResultSet rs) throws java.sql.SQLException {
        Long value = (Long) rs.getObject("previous_rank");
        return value == null ? null : value.intValue();
    }

    public record ConcertRankRow(int rank, Integer previousRank, long score, Long concertId,
                                 String title, String stadiumName, String posterKey) {
    }

    public record PhotocardRankRow(int rank, Integer previousRank, long tradeCount, long tradedAmount,
                                   Long designId, String designName, String imageUrl,
                                   String performanceTitle, Long photocardId, Long auctionId,
                                   String marketType) {
    }
}
