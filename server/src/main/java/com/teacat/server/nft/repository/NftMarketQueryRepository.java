package com.teacat.server.nft.repository;

import com.teacat.server.nft.dto.request.NftMarketSort;
import com.teacat.server.nft.entity.NftMintStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class NftMarketQueryRepository {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public List<MarketRow> findMarketPhotocards(Long performanceId,
                                                String keyword,
                                                NftMarketSort sort,
                                                String cursorValue,
                                                Long cursorId,
                                                int limit) {
        StringBuilder sql = new StringBuilder("""
                SELECT p.id AS photocard_id, l.id AS listing_id, d.name AS design_name,
                       d.image_url, pg.title AS performance_title, l.price,
                       seller.nickname AS seller_nickname, l.listed_at
                FROM nft_photocard_listings l
                JOIN nft_photocards p ON p.id = l.photocard_id
                JOIN nft_photocard_designs d ON d.id = p.design_id
                JOIN performance_general pg ON pg.id = d.performance_general_id
                JOIN users seller ON seller.id = l.seller_id
                WHERE l.status = 'ACTIVE'
                """);
        MapSqlParameterSource params = new MapSqlParameterSource();

        if (performanceId != null) {
            sql.append(" AND d.performance_general_id = :performanceId");
            params.addValue("performanceId", performanceId);
        }
        if (keyword != null) {
            sql.append(" AND d.name ILIKE :keyword");
            params.addValue("keyword", '%' + escapeLike(keyword) + '%');
        }
        appendMarketCursor(sql, params, sort, cursorValue, cursorId);
        sql.append(switch (sort) {
            case RECENT -> " ORDER BY l.listed_at DESC, l.id DESC";
            case PRICE_ASC -> " ORDER BY l.price ASC, l.id ASC";
            case PRICE_DESC -> " ORDER BY l.price DESC, l.id DESC";
        });
        sql.append(" LIMIT :limit");
        params.addValue("limit", limit);

        return jdbcTemplate.query(sql.toString(), params, (rs, rowNum) -> new MarketRow(
                rs.getLong("photocard_id"),
                rs.getLong("listing_id"),
                rs.getString("design_name"),
                rs.getString("image_url"),
                rs.getString("performance_title"),
                rs.getLong("price"),
                rs.getString("seller_nickname"),
                rs.getObject("listed_at", LocalDateTime.class)
        ));
    }

    public Optional<DetailRow> findPhotocardDetail(Long photocardId) {
        String sql = """
                SELECT p.id AS photocard_id, d.name AS design_name, d.image_url,
                       pg.title AS performance_title, owner.nickname AS owner_nickname,
                       p.created_at AS issued_at, pa.grade AS seat_grade, a.area_code,
                       s.row_label, s.seat_number, p.status, l.id AS listing_id,
                       l.price, l.description AS seller_description, l.listed_at
                FROM nft_photocards p
                JOIN nft_photocard_designs d ON d.id = p.design_id
                JOIN performance_general pg ON pg.id = d.performance_general_id
                JOIN users owner ON owner.id = p.owner_id
                JOIN tickets t ON t.id = p.ticket_id
                JOIN areas a ON a.id = t.area_id
                LEFT JOIN seats s ON s.id = t.seat_id
                LEFT JOIN performance_areas pa
                       ON pa.performance_general_id = pg.id AND pa.area_id = t.area_id
                LEFT JOIN nft_photocard_listings l
                       ON l.photocard_id = p.id AND l.status = 'ACTIVE'
                WHERE p.id = :photocardId
                """;
        List<DetailRow> rows = jdbcTemplate.query(sql, new MapSqlParameterSource("photocardId", photocardId),
                (rs, rowNum) -> new DetailRow(
                        rs.getLong("photocard_id"),
                        rs.getString("design_name"),
                        rs.getString("image_url"),
                        rs.getString("performance_title"),
                        rs.getString("owner_nickname"),
                        rs.getObject("issued_at", LocalDateTime.class),
                        rs.getString("seat_grade"),
                        rs.getString("area_code"),
                        rs.getString("row_label"),
                        (Integer) rs.getObject("seat_number"),
                        NftMintStatus.valueOf(rs.getString("status")),
                        (Long) rs.getObject("listing_id"),
                        (Long) rs.getObject("price"),
                        rs.getString("seller_description"),
                        rs.getObject("listed_at", LocalDateTime.class)
                ));
        return rows.stream().findFirst();
    }

    public List<UserTradeRow> findPurchaseHistory(Long userId,
                                                  LocalDateTime cursorAt,
                                                  Long cursorId,
                                                  int limit) {
        return findUserTradeHistory("t.buyer_id", "seller.nickname", userId, cursorAt, cursorId, limit);
    }

    public List<UserTradeRow> findSaleHistory(Long userId,
                                              LocalDateTime cursorAt,
                                              Long cursorId,
                                              int limit) {
        return findUserTradeHistory("t.seller_id", "buyer.nickname", userId, cursorAt, cursorId, limit);
    }

    public List<OwnedRow> findOwnedPhotocards(Long userId,
                                              Boolean listed,
                                              LocalDateTime cursorAt,
                                              Long cursorId,
                                              int limit) {
        StringBuilder sql = new StringBuilder("""
                SELECT p.id AS photocard_id, d.name AS design_name, d.image_url,
                       pg.title AS performance_title, p.status, p.created_at,
                       CASE WHEN l.id IS NULL THEN false ELSE true END AS listed
                FROM nft_photocards p
                JOIN nft_photocard_designs d ON d.id = p.design_id
                JOIN performance_general pg ON pg.id = d.performance_general_id
                LEFT JOIN nft_photocard_listings l
                       ON l.photocard_id = p.id AND l.status = 'ACTIVE'
                WHERE p.owner_id = :userId
                """);
        MapSqlParameterSource params = new MapSqlParameterSource("userId", userId);
        if (listed != null) {
            sql.append(listed ? " AND l.id IS NOT NULL" : " AND l.id IS NULL");
        }
        appendTimeCursor(sql, params, "p.created_at", "p.id", cursorAt, cursorId);
        sql.append(" ORDER BY p.created_at DESC, p.id DESC LIMIT :limit");
        params.addValue("limit", limit);

        return jdbcTemplate.query(sql.toString(), params, (rs, rowNum) -> new OwnedRow(
                rs.getLong("photocard_id"),
                rs.getString("design_name"),
                rs.getString("image_url"),
                rs.getString("performance_title"),
                NftMintStatus.valueOf(rs.getString("status")),
                rs.getBoolean("listed"),
                rs.getObject("created_at", LocalDateTime.class)
        ));
    }

    public List<CardTradeRow> findPhotocardTrades(Long photocardId,
                                                  LocalDateTime cursorAt,
                                                  Long cursorId,
                                                  int limit) {
        StringBuilder sql = new StringBuilder("""
                SELECT t.id AS trade_id, t.price, seller.nickname AS seller_nickname,
                       buyer.nickname AS buyer_nickname, t.traded_at
                FROM nft_photocard_trades t
                JOIN users seller ON seller.id = t.seller_id
                JOIN users buyer ON buyer.id = t.buyer_id
                WHERE t.photocard_id = :photocardId
                """);
        MapSqlParameterSource params = new MapSqlParameterSource("photocardId", photocardId);
        appendTimeCursor(sql, params, "t.traded_at", "t.id", cursorAt, cursorId);
        sql.append(" ORDER BY t.traded_at DESC, t.id DESC LIMIT :limit");
        params.addValue("limit", limit);

        return jdbcTemplate.query(sql.toString(), params, (rs, rowNum) -> new CardTradeRow(
                rs.getLong("trade_id"),
                rs.getLong("price"),
                rs.getString("seller_nickname"),
                rs.getString("buyer_nickname"),
                rs.getObject("traded_at", LocalDateTime.class)
        ));
    }

    public boolean lockPerformance(Long performanceId) {
        String sql = "SELECT id FROM performance_general WHERE id = :performanceId FOR UPDATE";
        return !jdbcTemplate.queryForList(sql,
                new MapSqlParameterSource("performanceId", performanceId), Long.class).isEmpty();
    }

    /**
     * 한 사용자의 구매 요청을 직렬화한다. 추후 CAT 계정 행 잠금이 들어오면 그 잠금으로 대체할 수 있다.
     */
    public void lockPurchaseBuyer(Long userId) {
        String sql = "SELECT pg_advisory_xact_lock(739001000000000000 + :userId)";
        jdbcTemplate.query(sql, new MapSqlParameterSource("userId", userId), rs -> {
            // 잠금 함수의 반환값은 void이므로 결과값은 읽지 않는다.
        });
    }

    public List<TicketRecipientRow> findConfirmedTicketRecipients(Long performanceId) {
        String sql = """
                SELECT t.id AS ticket_id, t.user_id
                FROM tickets t
                JOIN performance_details pd ON pd.id = t.performance_detail_id
                WHERE pd.performance_general_id = :performanceId
                  AND t.status = 'CONFIRMED'
                ORDER BY t.id
                """;
        return jdbcTemplate.query(sql, new MapSqlParameterSource("performanceId", performanceId),
                (rs, rowNum) -> new TicketRecipientRow(
                        rs.getLong("ticket_id"),
                        rs.getLong("user_id")
                ));
    }

    public void batchIssuePhotocards(List<IssueRow> rows) {
        String sql = """
                INSERT INTO nft_photocards (design_id, ticket_id, owner_id, status)
                VALUES (?, ?, ?, 'PENDING')
                """;
        jdbcTemplate.getJdbcTemplate().batchUpdate(sql, rows, 500, (statement, row) -> {
            statement.setLong(1, row.designId());
            statement.setLong(2, row.ticketId());
            statement.setLong(3, row.ownerId());
        });
    }

    private List<UserTradeRow> findUserTradeHistory(String userColumn,
                                                    String counterpartyColumn,
                                                    Long userId,
                                                    LocalDateTime cursorAt,
                                                    Long cursorId,
                                                    int limit) {
        StringBuilder sql = new StringBuilder("""
                SELECT t.id AS trade_id, p.id AS photocard_id, d.name AS design_name,
                       d.image_url, %s AS counterparty_nickname, t.price, t.traded_at
                FROM nft_photocard_trades t
                JOIN nft_photocards p ON p.id = t.photocard_id
                JOIN nft_photocard_designs d ON d.id = p.design_id
                JOIN users seller ON seller.id = t.seller_id
                JOIN users buyer ON buyer.id = t.buyer_id
                WHERE %s = :userId
                """.formatted(counterpartyColumn, userColumn));
        MapSqlParameterSource params = new MapSqlParameterSource("userId", userId);
        appendTimeCursor(sql, params, "t.traded_at", "t.id", cursorAt, cursorId);
        sql.append(" ORDER BY t.traded_at DESC, t.id DESC LIMIT :limit");
        params.addValue("limit", limit);

        return jdbcTemplate.query(sql.toString(), params, (rs, rowNum) -> new UserTradeRow(
                rs.getLong("trade_id"),
                rs.getLong("photocard_id"),
                rs.getString("design_name"),
                rs.getString("image_url"),
                rs.getString("counterparty_nickname"),
                rs.getLong("price"),
                rs.getObject("traded_at", LocalDateTime.class)
        ));
    }

    private void appendMarketCursor(StringBuilder sql,
                                    MapSqlParameterSource params,
                                    NftMarketSort sort,
                                    String cursorValue,
                                    Long cursorId) {
        if (cursorValue == null) {
            return;
        }
        params.addValue("cursorId", cursorId);
        if (sort == NftMarketSort.RECENT) {
            params.addValue("cursorAt", LocalDateTime.parse(cursorValue));
            sql.append(" AND (l.listed_at < :cursorAt OR (l.listed_at = :cursorAt AND l.id < :cursorId))");
            return;
        }

        params.addValue("cursorPrice", Long.parseLong(cursorValue));
        if (sort == NftMarketSort.PRICE_ASC) {
            sql.append(" AND (l.price > :cursorPrice OR (l.price = :cursorPrice AND l.id > :cursorId))");
        } else {
            sql.append(" AND (l.price < :cursorPrice OR (l.price = :cursorPrice AND l.id < :cursorId))");
        }
    }

    private void appendTimeCursor(StringBuilder sql,
                                  MapSqlParameterSource params,
                                  String timeColumn,
                                  String idColumn,
                                  LocalDateTime cursorAt,
                                  Long cursorId) {
        if (cursorAt == null) {
            return;
        }
        sql.append(" AND (").append(timeColumn).append(" < :cursorAt OR (")
                .append(timeColumn).append(" = :cursorAt AND ").append(idColumn).append(" < :cursorId))");
        params.addValue("cursorAt", cursorAt);
        params.addValue("cursorId", cursorId);
    }

    private String escapeLike(String keyword) {
        return keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    public record MarketRow(Long photocardId, Long listingId, String designName, String imageUrl,
                            String performanceTitle, Long price, String sellerNickname,
                            LocalDateTime listedAt) {
    }

    public record DetailRow(Long photocardId, String designName, String imageUrl,
                            String performanceTitle, String ownerNickname, LocalDateTime issuedAt,
                            String seatGrade, String areaCode, String rowLabel, Integer seatNumber,
                            NftMintStatus status, Long listingId, Long price, String sellerDescription,
                            LocalDateTime listedAt) {
    }

    public record UserTradeRow(Long tradeId, Long photocardId, String designName, String imageUrl,
                               String counterpartyNickname, Long price, LocalDateTime tradedAt) {
    }

    public record OwnedRow(Long photocardId, String designName, String imageUrl,
                           String performanceTitle, NftMintStatus status, boolean listed,
                           LocalDateTime createdAt) {
    }

    public record CardTradeRow(Long tradeId, Long price, String sellerNickname,
                               String buyerNickname, LocalDateTime tradedAt) {
    }

    public record TicketRecipientRow(Long ticketId, Long userId) {
    }

    public record IssueRow(Long designId, Long ticketId, Long ownerId) {
    }
}
