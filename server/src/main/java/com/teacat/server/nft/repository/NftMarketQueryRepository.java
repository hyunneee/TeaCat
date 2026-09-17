package com.teacat.server.nft.repository;

import com.teacat.server.nft.dto.request.NftMarketSort;
import com.teacat.server.nft.entity.NftMintStatus;
import com.teacat.server.nft.entity.NftPhotocardGrade;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.math.BigDecimal;
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
                LEFT JOIN performance_general pg ON pg.id = d.performance_general_id
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
                       pg.title AS performance_title,
                       -- 조회자가 소유자인지 판정해야 한다. 닉네임으로 비교하면 동명이인에서 깨진다
                       p.owner_id, owner.nickname AS owner_nickname,
                       p.created_at AS issued_at, t.id AS ticket_id, pa.grade AS seat_grade, a.area_code,
                       s.row_label, s.seat_number, p.status, l.id AS listing_id,
                       l.price, l.description AS seller_description, l.listed_at,
                       d.group_name, d.grade::text AS grade,
                       (SELECT round(avg(tr.price))::bigint
                          FROM nft_photocard_trades tr
                          JOIN nft_photocards pc ON pc.id = tr.photocard_id
                         WHERE pc.design_id = d.id
                           AND tr.chain_status = 'COMPLETED') AS average_price
                FROM nft_photocards p
                JOIN nft_photocard_designs d ON d.id = p.design_id
                LEFT JOIN performance_general pg ON pg.id = d.performance_general_id
                JOIN users owner ON owner.id = p.owner_id
                -- 뽑기 카드는 티켓·좌석이 없다. 내부 조인이면 행이 통째로 빠진다
                LEFT JOIN tickets t ON t.id = p.ticket_id
                LEFT JOIN areas a ON a.id = t.area_id
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
                        rs.getLong("owner_id"),
                        rs.getString("owner_nickname"),
                        rs.getObject("issued_at", LocalDateTime.class),
                        rs.getObject("ticket_id") != null,
                        rs.getString("seat_grade"),
                        rs.getString("area_code"),
                        rs.getString("row_label"),
                        (Integer) rs.getObject("seat_number"),
                        NftMintStatus.valueOf(rs.getString("status")),
                        (Long) rs.getObject("listing_id"),
                        (Long) rs.getObject("price"),
                        rs.getString("seller_description"),
                        rs.getObject("listed_at", LocalDateTime.class),
                        rs.getString("group_name"),
                        rs.getString("grade") == null ? null : NftPhotocardGrade.valueOf(rs.getString("grade")),
                        (Long) rs.getObject("average_price")
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
                       CASE WHEN l.id IS NULL THEN false ELSE true END AS listed,
                       d.group_name, d.grade::text AS grade,
                       (SELECT round(avg(tr.price))::bigint
                          FROM nft_photocard_trades tr
                          JOIN nft_photocards pc ON pc.id = tr.photocard_id
                         WHERE pc.design_id = d.id
                           AND tr.chain_status = 'COMPLETED') AS average_price
                FROM nft_photocards p
                JOIN nft_photocard_designs d ON d.id = p.design_id
                LEFT JOIN performance_general pg ON pg.id = d.performance_general_id
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
                rs.getObject("created_at", LocalDateTime.class),
                rs.getString("group_name"),
                rs.getString("grade") == null ? null : NftPhotocardGrade.valueOf(rs.getString("grade")),
                (Long) rs.getObject("average_price")
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
                  AND t.chain_status = 'COMPLETED'
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

    /**
     * 그 공연의 <b>전 회차 좌석 합계</b> (구역 정원 합 × 회차 수).
     *
     * <p>도안 수량은 공연 단위로 붙는데 관객은 회차마다 있다. 그래서 "회차 수만큼 곱하는 것" 을
     * 잊으면 뒤 회차 관객이 못 뽑는다 — 어드민이 그걸 사람 기억에 맡기지 않도록 서버가 계산해 준다.
     *
     * <p>지정석은 공연장 구역의 좌석 수({@code areas.max_seat})가 정원이고, 스탠딩은 공연별로
     * 정한 최대 인원({@code performance_areas.max_cnt})이 정원이다. 구역이 없거나 회차가 없으면 0 이다.
     */
    public long sumSeatCapacityAcrossSchedules(Long performanceId) {
        String sql = """
                SELECT COALESCE((SELECT sum(CASE
                                                WHEN pa.sale_type = 'SEATED' THEN a.max_seat
                                                ELSE pa.max_cnt
                                            END)
                                   FROM performance_areas pa
                                   JOIN areas a ON a.id = pa.area_id
                                  WHERE pa.performance_general_id = :performanceId), 0)
                     * (SELECT count(*) FROM performance_details pd
                         WHERE pd.performance_general_id = :performanceId)
                """;
        Long capacity = jdbcTemplate.queryForObject(sql,
                new MapSqlParameterSource().addValue("performanceId", performanceId), Long.class);
        return capacity == null ? 0L : capacity;
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

    /**
     * 카드 행을 만든다. <b>{@code wallet_id} 를 여기서 채운다</b> — 발행을 보내려면 받는 주소가
     * 필요하고, 그 주소는 이 지갑에서 나온다.
     *
     * <p>{@code status} 는 {@code PENDING} 으로 시작한다. 그 뒤 {@code MINTING → MINTED} 는
     * 블록체인 서비스가 옮긴다 (PHOTOCARD_PLAN.md 6-4).
     */
    public void batchIssuePhotocards(List<IssueRow> rows) {
        String sql = """
                INSERT INTO nft_photocards (design_id, ticket_id, owner_id, wallet_id, status)
                VALUES (?, ?, ?, ?, 'PENDING')
                """;
        jdbcTemplate.getJdbcTemplate().batchUpdate(sql, rows, 500, (statement, row) -> {
            statement.setLong(1, row.designId());
            statement.setLong(2, row.ticketId());
            statement.setLong(3, row.ownerId());
            statement.setLong(4, row.walletId());
        });
    }

    /**
     * 유저별 지갑. 발행 대상 주소를 찾는다.
     *
     * <p>체인마다 주소가 다르므로 {@code chainId} 로 좁힌다. 지갑이 없는 유저는 결과에
     * 안 나오고, 부르는 쪽이 그걸로 발급 전체를 거절한다 — 카드가 절반만 나간 공연을
     * 수습하는 비용이 훨씬 크다.
     */
    public List<UserWalletRow> findActiveWallets(List<Long> userIds, int chainId) {
        if (userIds.isEmpty()) {
            return List.of();
        }

        String sql = """
                SELECT wo.user_id, w.id AS wallet_id, w.address
                FROM wallet_owners wo
                JOIN wallets w ON w.owner_id = wo.id
                WHERE wo.user_id IN (:userIds)
                  AND w.chain_id = :chainId
                  AND w.status = 'ACTIVE'
                """;
        return jdbcTemplate.query(sql,
                new MapSqlParameterSource()
                        .addValue("userIds", userIds)
                        .addValue("chainId", chainId),
                (rs, rowNum) -> new UserWalletRow(
                        rs.getLong("user_id"),
                        rs.getLong("wallet_id"),
                        // char(42) 라 뒤가 공백으로 채워져 올 수 있다
                        rs.getString("address").trim()
                ));
    }

    /**
     * 아직 체인에 안 보낸 카드. 발행 재시도(티켓 발급 경로)가 쓴다.
     *
     * <p>{@code PENDING} 만 고른다 — {@code MINTING} 은 트랜잭션이 이미 나가 확정을 기다리는
     * 중이라 다시 보내면 안 된다.
     *
     * <p>🔴 {@code p.ticket_id IS NOT NULL} 로 좁힌다. 뽑기 풀 도안이 공연에 묶일 수 있게 되면서
     * {@code d.performance_general_id} 만으로는 그 공연 팩에서 뽑힌 카드(티켓 NULL)까지 걸려,
     * {@code POST /admin/performances/{id}/photocards/mint} 와 뽑기 스위퍼({@link #findPendingDrawMints})가
     * 같은 카드를 동시에 보내는 중복 트랜잭션이 생겼었다(C3).
     */
    public List<PendingMintRow> findPendingMints(Long performanceId, int limit) {
        String sql = """
                SELECT p.id AS photocard_id, COALESCE(p.issue_key, p.id::text) AS issue_key,
                       p.design_id, COALESCE(d.chain_token_id, d.id::numeric) AS chain_token_id,
                       w.address
                FROM nft_photocards p
                JOIN nft_photocard_designs d ON d.id = p.design_id
                JOIN wallets w ON w.id = p.wallet_id
                WHERE d.performance_general_id = :performanceId
                  AND p.status = 'PENDING'
                  AND p.wallet_id IS NOT NULL
                  AND p.ticket_id IS NOT NULL
                ORDER BY p.id
                LIMIT :limit
                """;
        return jdbcTemplate.query(sql,
                new MapSqlParameterSource()
                        .addValue("performanceId", performanceId)
                        .addValue("limit", limit),
                (rs, rowNum) -> new PendingMintRow(
                        rs.getLong("photocard_id"),
                        rs.getString("issue_key"),
                        rs.getLong("design_id"),
                        rs.getBigDecimal("chain_token_id"),
                        rs.getString("address").trim()
                ));
    }

    /**
     * 체인에 아직 안 보낸 <b>뽑기</b> 카드. 티켓이 없는 PENDING 카드다.
     *
     * <p>{@link #findPendingMints} 는 이제 {@code p.ticket_id IS NOT NULL} 로 좁혀 뽑기 카드를
     * 아예 보지 않으므로 기능적으로는 이 조회 하나로 합쳐도 결과가 같다. 그래도 따로 두는 이유는
     * 스코프다 — {@link #findPendingMints}·{@link #findPendingMintsForSchedule} 은 어드민이 공연·
     * 회차 하나를 지정해 부르는 "재시도" 경로이고, 이건 <b>공연을 모르는 채로 전체를 훑는</b> 스위퍼
     * 전용이라 인덱스도 공연 조건 없이 {@code idx_nft_photocards_pending_draw} 하나로 충분하다.
     * 하나로 합치면 스위퍼가 매번 전체 테이블에서 티켓 유무를 걸러야 해 그 인덱스를 못 탄다.
     */
    public List<PendingMintRow> findPendingDrawMints(int limit) {
        String sql = """
                SELECT p.id AS photocard_id, COALESCE(p.issue_key, p.id::text) AS issue_key,
                       p.design_id, COALESCE(d.chain_token_id, d.id::numeric) AS chain_token_id,
                       w.address
                FROM nft_photocards p
                JOIN nft_photocard_designs d ON d.id = p.design_id
                JOIN wallets w ON w.id = p.wallet_id
                WHERE p.status = 'PENDING'
                  AND p.ticket_id IS NULL
                  AND p.wallet_id IS NOT NULL
                ORDER BY p.id
                LIMIT :limit
                """;
        return jdbcTemplate.query(sql,
                new MapSqlParameterSource("limit", limit),
                (rs, rowNum) -> new PendingMintRow(
                        rs.getLong("photocard_id"),
                        rs.getString("issue_key"),
                        rs.getLong("design_id"),
                        rs.getBigDecimal("chain_token_id"),
                        rs.getString("address").trim()
                ));
    }

    /* ── 회차(performance_detail) 단위 자동 발급 ────────────────────────────────
       발급 로직 자체는 공연(performance_general) 단위지만, 스케줄러는 "회차 시작
       1시간 전" 이라는 회차 시각을 기준으로 대상을 고른다. 그래서 티켓·카드를
       performance_detail_id 로 좁힌 조회가 따로 필요하다. */

    /**
     * 지금부터 {@code until} 사이에 시작하는 회차 중, <b>아직 포토카드를 못 받은 확정 티켓이
     * 남아 있는</b> 회차 id. 발급이 끝났거나 확정 티켓이 없는 회차는 빠진다.
     *
     * <p>{@code from} 을 하한으로 둬서 이미 시작한(지난) 회차는 대상에서 제외한다 —
     * 시작 시각이 지나면 발급할 이유가 없다.
     */
    public List<Long> findScheduleIdsDueForIssue(LocalDateTime from, LocalDateTime until, int limit) {
        String sql = """
                SELECT pd.id
                FROM performance_details pd
                WHERE pd.performance_date > :from
                  AND pd.performance_date <= :until
                  AND EXISTS (
                        SELECT 1 FROM tickets t
                        WHERE t.performance_detail_id = pd.id
                          AND t.status = 'CONFIRMED'
                          AND NOT EXISTS (
                                SELECT 1 FROM nft_photocards p WHERE p.ticket_id = t.id))
                ORDER BY pd.performance_date, pd.id
                LIMIT :limit
                """;
        return jdbcTemplate.queryForList(sql,
                new MapSqlParameterSource()
                        .addValue("from", from)
                        .addValue("until", until)
                        .addValue("limit", limit),
                Long.class);
    }

    /** 동시에 도는 스케줄러 tick·수동 트리거를 한 회차 안에서 직렬화한다. 회차가 없으면 false */
    public boolean lockSchedule(Long scheduleId) {
        String sql = "SELECT id FROM performance_details WHERE id = :scheduleId FOR UPDATE";
        return !jdbcTemplate.queryForList(sql,
                new MapSqlParameterSource("scheduleId", scheduleId), Long.class).isEmpty();
    }

    /** 회차가 속한 공연 id. 도안은 공연 단위라 부모 공연을 알아야 배정할 수 있다 */
    public Optional<Long> findPerformanceIdBySchedule(Long scheduleId) {
        String sql = "SELECT performance_general_id FROM performance_details WHERE id = :scheduleId";
        return jdbcTemplate.queryForList(sql,
                        new MapSqlParameterSource("scheduleId", scheduleId), Long.class)
                .stream().findFirst();
    }

    public List<TicketRecipientRow> findConfirmedTicketRecipientsForSchedule(Long scheduleId) {
        String sql = """
                SELECT t.id AS ticket_id, t.user_id
                FROM tickets t
                WHERE t.performance_detail_id = :scheduleId
                  AND t.status = 'CONFIRMED'
                ORDER BY t.id
                """;
        return jdbcTemplate.query(sql, new MapSqlParameterSource("scheduleId", scheduleId),
                (rs, rowNum) -> new TicketRecipientRow(
                        rs.getLong("ticket_id"),
                        rs.getLong("user_id")
                ));
    }

    /** 이 회차의 티켓으로 이미 만들어진 포토카드가 하나라도 있는지. 스케줄러 재실행의 이중 발급을 막는다 */
    public boolean existsPhotocardForSchedule(Long scheduleId) {
        String sql = """
                SELECT EXISTS (
                    SELECT 1 FROM nft_photocards p
                    JOIN tickets t ON t.id = p.ticket_id
                    WHERE t.performance_detail_id = :scheduleId)
                """;
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                sql, new MapSqlParameterSource("scheduleId", scheduleId), Boolean.class));
    }

    /** {@link #findPendingMints} 의 회차 스코프 버전. 이 회차 티켓의 PENDING 카드만 고른다 */
    public List<PendingMintRow> findPendingMintsForSchedule(Long scheduleId, int limit) {
        String sql = """
                SELECT p.id AS photocard_id, COALESCE(p.issue_key, p.id::text) AS issue_key,
                       p.design_id, COALESCE(d.chain_token_id, d.id::numeric) AS chain_token_id,
                       w.address
                FROM nft_photocards p
                JOIN tickets t ON t.id = p.ticket_id
                JOIN nft_photocard_designs d ON d.id = p.design_id
                JOIN wallets w ON w.id = p.wallet_id
                WHERE t.performance_detail_id = :scheduleId
                  AND p.status = 'PENDING'
                  AND p.wallet_id IS NOT NULL
                ORDER BY p.id
                LIMIT :limit
                """;
        return jdbcTemplate.query(sql,
                new MapSqlParameterSource()
                        .addValue("scheduleId", scheduleId)
                        .addValue("limit", limit),
                (rs, rowNum) -> new PendingMintRow(
                        rs.getLong("photocard_id"),
                        rs.getString("issue_key"),
                        rs.getLong("design_id"),
                        rs.getBigDecimal("chain_token_id"),
                        rs.getString("address").trim()
                ));
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
                  AND t.chain_status = 'COMPLETED'
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
                            String performanceTitle, Long ownerId, String ownerNickname,
                            LocalDateTime issuedAt,
                            boolean hasTicket,
                            String seatGrade, String areaCode, String rowLabel, Integer seatNumber,
                            NftMintStatus status, Long listingId, Long price, String sellerDescription,
                            LocalDateTime listedAt,
                            String groupName, NftPhotocardGrade grade, Long averagePrice) {
    }

    public record UserTradeRow(Long tradeId, Long photocardId, String designName, String imageUrl,
                               String counterpartyNickname, Long price, LocalDateTime tradedAt) {
    }

    public record OwnedRow(Long photocardId, String designName, String imageUrl,
                           String performanceTitle, NftMintStatus status, boolean listed,
                           LocalDateTime createdAt,
                           String groupName, NftPhotocardGrade grade, Long averagePrice) {
    }

    public record CardTradeRow(Long tradeId, Long price, String sellerNickname,
                               String buyerNickname, LocalDateTime tradedAt) {
    }

    public record TicketRecipientRow(Long ticketId, Long userId) {
    }

    public record IssueRow(Long designId, Long ticketId, Long ownerId, Long walletId) {
    }

    public record UserWalletRow(Long userId, Long walletId, String address) {
    }

    /** 발행 요청에 실어 보낼 한 장. 관계형 ID와 온체인 식별자를 함께 유지한다. */
    public record PendingMintRow(Long photocardId, String issueKey, Long designId,
                                 BigDecimal chainTokenId, String address) {
    }
}
