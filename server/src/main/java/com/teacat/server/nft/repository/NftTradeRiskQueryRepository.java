package com.teacat.server.nft.repository;

import com.teacat.server.common.config.NftTradeReviewProperties;
import com.teacat.server.nft.service.TradeRiskContext;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 이상거래 규칙이 볼 맥락을 거래 하나에 대해 한 번에 모은다 (native SQL, 읽기 전용).
 *
 * <p>규칙마다 따로 조회하지 않고 여기서 열 개 안팎의 짧은 쿼리로 {@link TradeRiskContext} 를 만든다.
 * 호출자(정산 Writer)의 트랜잭션 안에서 돈다. 전부 인덱스를 타는 단순 집계라 마감 직전에도 몇 ms 다.
 *
 * <p>완료된 거래만 시세·거래량·거래쌍의 표본이다 — 보류·실패·보상된 거래는 시장 가격이 아니다.
 */
@Repository
@RequiredArgsConstructor
public class NftTradeRiskQueryRepository {

    private static final String BASE_SQL = """
            SELECT t.id, t.price, t.auction_id, t.listing_id, t.photocard_id, p.design_id, d.issued_supply,
                   t.created_at AS trade_created_at, t.client_ip AS trade_ip, t.user_agent_hash AS trade_ua,
                   t.payment_hold_ref_type::text AS hold_type,
                   s.id AS seller_id, s.phone AS seller_phone, s.created_at AS seller_created_at,
                   b.id AS buyer_id, b.phone AS buyer_phone, b.created_at AS buyer_created_at,
                   a.client_ip AS auction_ip, a.user_agent_hash AS auction_ua,
                   l.client_ip AS listing_ip, l.user_agent_hash AS listing_ua
              FROM nft_photocard_trades t
              JOIN nft_photocards p ON p.id = t.photocard_id
              JOIN nft_photocard_designs d ON d.id = p.design_id
              JOIN users s ON s.id = t.seller_id
              JOIN users b ON b.id = t.buyer_id
              LEFT JOIN nft_auctions a ON a.id = t.auction_id
              LEFT JOIN nft_photocard_listings l ON l.id = t.listing_id
             WHERE t.id = :tradeId
            """;

    /** 경로 탐색 깊이 한계. 3이면 A→B→C→A 고리까지 본다. 늘리면 정산 트랜잭션이 느려진다 */
    private static final int MAX_HOPS = 3;

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public Optional<TradeRiskContext> loadContext(Long tradeId, NftTradeReviewProperties p) {
        List<BaseRow> rows = jdbcTemplate.query(BASE_SQL, Map.of("tradeId", tradeId), (rs, i) -> readBase(rs));
        if (rows.isEmpty()) {
            return Optional.empty();
        }
        BaseRow base = rows.getFirst();
        LocalDateTime now = currentTime();

        boolean auction = base.auctionId != null;
        boolean naturalClose = auction && CatMoneyHoldRefType.AUCTION_BID.name().equals(base.holdType);

        // 구매자의 단말과 "돈을 걸기로 한 시각". 자연 낙찰은 최고 입찰 행, 나머지는 거래 행이 갖고 있다
        String buyerIp = base.tradeIp;
        String buyerUa = base.tradeUa;
        LocalDateTime requestAt = base.tradeCreatedAt;
        if (naturalClose) {
            BidRow top = topBidOf(base.auctionId, base.buyerId);
            if (top != null) {
                buyerIp = top.ip;
                buyerUa = top.ua;
            }
            LocalDateTime firstBid = firstBidAt(base.auctionId, base.buyerId);
            if (firstBid != null) {
                requestAt = firstBid;
            }
        }

        TradeRiskContext.Party seller = new TradeRiskContext.Party(base.sellerId, base.sellerPhone, base.sellerCreatedAt,
                auction ? base.auctionIp : base.listingIp, auction ? base.auctionUa : base.listingUa);
        TradeRiskContext.Party buyer = new TradeRiskContext.Party(base.buyerId, base.buyerPhone, base.buyerCreatedAt,
                buyerIp, buyerUa);
        TradeRiskContext.Party runnerUp = auction ? runnerUpOf(base.auctionId, base.buyerId) : null;

        LocalDateTime pairSince = now.minus(p.pairWindow());
        LocalDateTime priceSince = now.minus(p.priceWindow());
        LocalDateTime volumeSince = now.minus(p.volumeWindow());
        LocalDateTime baselineSince = volumeSince.minusWeeks(Math.max(1, p.volumeBaselineWeeks()));
        LocalDateTime loginSince = now.minus(p.takeoverLoginWindow());

        PairStats pair = pairStats(base.sellerId, base.buyerId, base.photocardId, pairSince);
        PriceStats price = priceStats(base.designId, base.buyerId, tradeId, priceSince);
        VolumeStats volume = volumeStats(base.designId, base.sellerId, base.buyerId, volumeSince, baselineSince);
        int buyerOwned = buyerOwnedOfDesign(base.designId, base.buyerId);
        LocalDateTime firstDeposit = firstDepositAt(base.buyerId);
        LoginStats login = loginStats(base.buyerId, buyerIp, buyerUa, loginSince, requestAt);
        SpendStats spend = buyerSpend(base.buyerId, tradeId, priceSince);
        TradeRiskContext.Graph graph = graphStats(base, tradeId, volumeSince);
        TradeRiskContext.Decoration decoration = decorationOf(base, requestAt);
        TradeRiskContext.Velocity velocity = velocityOf(base, tradeId, requestAt);

        return Optional.of(new TradeRiskContext(
                tradeId,
                auction ? TradeRiskContext.Source.AUCTION : TradeRiskContext.Source.LISTING,
                base.auctionId, base.listingId, base.price, base.photocardId, base.designId,
                seller, buyer, runnerUp, requestAt,
                pair.count, pair.cycled,
                price.median,
                volume.recent, volume.recentWithParties, volume.baseline,
                base.issuedSupply, buyerOwned, price.samples, price.buyerBuys,
                firstDeposit,
                login.priorOtherDevices, login.deviceFirstLogin, spend.max, spend.count,
                graph, decoration, velocity,
                now));
    }

    /** 규칙의 기간 계산과 마감 판정이 같은 시계를 쓰도록 DB 시각을 읽는다 */
    public LocalDateTime currentTime() {
        return jdbcTemplate.queryForObject("SELECT now()::timestamp", Map.of(), LocalDateTime.class);
    }

    private BidRow topBidOf(Long auctionId, Long bidderId) {
        List<BidRow> rows = jdbcTemplate.query("""
                SELECT client_ip, user_agent_hash FROM nft_auction_bids
                 WHERE auction_id = :auctionId AND bidder_id = :bidderId
                 ORDER BY amount DESC, id DESC LIMIT 1
                """, Map.of("auctionId", auctionId, "bidderId", bidderId),
                (rs, i) -> new BidRow(rs.getString("client_ip"), rs.getString("user_agent_hash")));
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private LocalDateTime firstBidAt(Long auctionId, Long bidderId) {
        return jdbcTemplate.queryForObject("""
                SELECT min(created_at) FROM nft_auction_bids WHERE auction_id = :auctionId AND bidder_id = :bidderId
                """, Map.of("auctionId", auctionId, "bidderId", bidderId), LocalDateTime.class);
    }

    private TradeRiskContext.Party runnerUpOf(Long auctionId, Long buyerId) {
        List<TradeRiskContext.Party> rows = jdbcTemplate.query("""
                SELECT u.id, u.phone, u.created_at, b.client_ip, b.user_agent_hash
                  FROM nft_auction_bids b
                  JOIN users u ON u.id = b.bidder_id
                 WHERE b.auction_id = :auctionId AND b.bidder_id <> :buyerId
                 ORDER BY b.amount DESC, b.id DESC LIMIT 1
                """, Map.of("auctionId", auctionId, "buyerId", buyerId),
                (rs, i) -> new TradeRiskContext.Party(rs.getLong("id"), rs.getString("phone"),
                        rs.getObject("created_at", LocalDateTime.class),
                        rs.getString("client_ip"), rs.getString("user_agent_hash")));
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private PairStats pairStats(Long sellerId, Long buyerId, Long photocardId, LocalDateTime since) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("s", sellerId).addValue("b", buyerId).addValue("pc", photocardId).addValue("since", since);
        return jdbcTemplate.queryForObject("""
                SELECT count(*) FILTER (WHERE completed_at >= :since) AS pair_count,
                       bool_or(photocard_id = :pc) AS cycled
                  FROM nft_photocard_trades
                 WHERE chain_status = 'COMPLETED'
                   AND ((seller_id = :s AND buyer_id = :b) OR (seller_id = :b AND buyer_id = :s))
                """, params, (rs, i) -> new PairStats(rs.getInt("pair_count"), rs.getBoolean("cycled")));
    }

    private PriceStats priceStats(Long designId, Long buyerId, Long tradeId, LocalDateTime since) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("d", designId).addValue("b", buyerId).addValue("tradeId", tradeId).addValue("since", since);
        return jdbcTemplate.queryForObject("""
                SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY t.price) AS median,
                       count(*) AS samples,
                       count(*) FILTER (WHERE t.buyer_id = :b) AS buyer_buys
                  FROM nft_photocard_trades t
                  JOIN nft_photocards p ON p.id = t.photocard_id
                 WHERE p.design_id = :d AND t.chain_status = 'COMPLETED'
                   AND t.completed_at >= :since AND t.id <> :tradeId
                """, params, (rs, i) -> {
            double median = rs.getDouble("median");
            boolean hasMedian = !rs.wasNull();
            return new PriceStats(hasMedian ? Math.round(median) : null, rs.getInt("samples"), rs.getInt("buyer_buys"));
        });
    }

    private VolumeStats volumeStats(Long designId, Long sellerId, Long buyerId,
                                    LocalDateTime recentSince, LocalDateTime baselineSince) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("d", designId).addValue("s", sellerId).addValue("b", buyerId)
                .addValue("recentSince", recentSince).addValue("baselineSince", baselineSince);
        return jdbcTemplate.queryForObject("""
                SELECT count(*) FILTER (WHERE t.completed_at >= :recentSince) AS recent,
                       count(*) FILTER (WHERE t.completed_at >= :recentSince
                                          AND (t.seller_id IN (:s, :b) OR t.buyer_id IN (:s, :b))) AS recent_with_parties,
                       count(*) FILTER (WHERE t.completed_at < :recentSince) AS baseline
                  FROM nft_photocard_trades t
                  JOIN nft_photocards p ON p.id = t.photocard_id
                 WHERE p.design_id = :d AND t.chain_status = 'COMPLETED' AND t.completed_at >= :baselineSince
                """, params, (rs, i) -> new VolumeStats(rs.getInt("recent"), rs.getInt("recent_with_parties"),
                rs.getInt("baseline")));
    }

    private int buyerOwnedOfDesign(Long designId, Long buyerId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT count(*) FROM nft_photocards WHERE design_id = :d AND owner_id = :b
                """, Map.of("d", designId, "b", buyerId), Integer.class);
        return count == null ? 0 : count;
    }

    private LocalDateTime firstDepositAt(Long buyerId) {
        return jdbcTemplate.queryForObject("""
                SELECT min(created_at) FROM cat_transactions WHERE user_id = :b AND reason = 'DEPOSIT'
                """, Map.of("b", buyerId), LocalDateTime.class);
    }

    private LoginStats loginStats(Long buyerId, String ip, String ua, LocalDateTime since, LocalDateTime requestAt) {
        if (ip == null || ua == null || requestAt == null) {
            return new LoginStats(0, null);
        }
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("b", buyerId).addValue("ip", ip).addValue("ua", ua)
                .addValue("since", since).addValue("requestAt", requestAt);
        return jdbcTemplate.queryForObject("""
                SELECT count(*) FILTER (WHERE NOT (client_ip = :ip AND user_agent_hash = :ua)) AS prior_other,
                       min(created_at) FILTER (WHERE client_ip = :ip AND user_agent_hash = :ua) AS device_first
                  FROM user_login_events
                 WHERE user_id = :b AND created_at >= :since AND created_at <= :requestAt
                """, params, (rs, i) -> new LoginStats(rs.getInt("prior_other"),
                rs.getObject("device_first", LocalDateTime.class)));
    }

    /**
     * 거래를 이어 놓아야 보이는 값들 (AUCTION_FRAUD_DESIGN.md 14-2-2). 피처 전용이고 규칙은 쓰지 않는다.
     *
     * <p>🔴 정산 트랜잭션 안에서 도는 조회다. 경로 탐색을 {@link #MAX_HOPS} 로 끊고 기간도
     * volume-window 로 좁혀 둔다 — 안 끊으면 거래가 늘수록 마감 직전에 정산이 느려진다.
     */
    private TradeRiskContext.Graph graphStats(BaseRow base, Long tradeId, LocalDateTime since) {
        MapSqlParameterSource cardParams = new MapSqlParameterSource()
                .addValue("pc", base.photocardId).addValue("b", base.buyerId)
                .addValue("tradeId", tradeId).addValue("since", since);
        CardStats card = jdbcTemplate.queryForObject("""
                SELECT bool_or(buyer_id = :b OR seller_id = :b) AS buyer_owned,
                       count(*) FILTER (WHERE completed_at >= :since) AS trades,
                       count(DISTINCT buyer_id) FILTER (WHERE completed_at >= :since) AS owners
                  FROM nft_photocard_trades
                 WHERE photocard_id = :pc AND chain_status = 'COMPLETED' AND id <> :tradeId
                """, cardParams, (rs, i) -> new CardStats(rs.getBoolean("buyer_owned"),
                rs.getInt("trades"), rs.getInt("owners")));

        return new TradeRiskContext.Graph(card.buyerOwned, card.trades, card.owners,
                shortestHops(base.buyerId, base.sellerId, tradeId, since));
    }

    /**
     * 거래 그래프(판매자 → 구매자)에서 구매자가 판매자에게 닿는 최단 경로. 닿지 않으면 null.
     *
     * <p>A→B→C→A 고리의 마지막 구간에서 2를 돌려준다 — 두 사람만 보는 R3 이 놓치는 바로 그 자리다.
     * 깊이를 {@link #MAX_HOPS} 로 끊으므로 더 긴 고리는 여전히 null 이고, 그건 의도한 한계다.
     */
    private Integer shortestHops(Long buyerId, Long sellerId, Long tradeId, LocalDateTime since) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("buyer", buyerId).addValue("seller", sellerId)
                .addValue("tradeId", tradeId).addValue("since", since).addValue("maxHops", MAX_HOPS);
        return jdbcTemplate.queryForObject("""
                WITH RECURSIVE edges AS (
                    SELECT DISTINCT seller_id AS src, buyer_id AS dst
                      FROM nft_photocard_trades
                     WHERE chain_status = 'COMPLETED' AND completed_at >= :since AND id <> :tradeId
                ), walk AS (
                    SELECT dst AS node, 1 AS hops FROM edges WHERE src = :buyer
                    UNION ALL
                    SELECT e.dst, w.hops + 1
                      FROM walk w JOIN edges e ON e.src = w.node
                     WHERE w.hops < :maxHops
                )
                SELECT min(hops) FROM walk WHERE node = :seller
                """, params, Integer.class);
    }

    /**
     * 카드에 얹힌 꾸밈. 한 카드에 하나뿐이다({@code uq_photocard_decorations_card}).
     *
     * <p>{@code updated_at} 을 쓴다 — 다시 꾸미면 갱신되므로 "마지막으로 손본 시각" 이 맞다.
     *
     * <p>🔴 이 표만 {@code timestamptz} 다. 나머지 시각은 전부 {@code timestamp}(세션 시간대의 벽시계)라
     * 그대로 빼면 어긋난다. {@code ::timestamp} 캐스트가 세션 시간대 벽시계로 맞춰 주므로
     * {@code now()::timestamp} 를 쓰는 다른 조회와 같은 시계가 된다.
     * ⚠️ {@code AT TIME ZONE 'UTC'} 로 바꾸면 KST 9시간이 통째로 더해진다 — 실제로 그렇게 짰다가
     *    "꾸민 뒤 3분" 이 "562분" 으로 나왔고 테스트가 잡았다.
     */
    private TradeRiskContext.Decoration decorationOf(BaseRow base, LocalDateTime requestAt) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("pc", base.photocardId).addValue("seller", base.sellerId)
                .addValue("requestAt", requestAt);
        List<TradeRiskContext.Decoration> rows = jdbcTemplate.query("""
                SELECT jsonb_array_length(placements) AS sticker_count,
                       (user_id = :seller) AS by_seller,
                       EXTRACT(EPOCH FROM (:requestAt - updated_at::timestamp)) / 60 AS minutes
                  FROM photocard_decorations
                 WHERE photocard_id = :pc
                """, params, (rs, i) -> {
            double minutes = rs.getDouble("minutes");
            Long since = rs.wasNull() || minutes < 0 ? null : Math.round(minutes);
            return new TradeRiskContext.Decoration(true, rs.getInt("sticker_count"), since,
                    rs.getBoolean("by_seller"));
        });
        return rows.isEmpty() ? TradeRiskContext.Decoration.NONE : rows.getFirst();
    }

    /**
     * 짧은 창의 거래 빈도. 금액을 보지 않으므로 시장 규모가 바뀌어도 뜻이 흔들리지 않는다.
     *
     * <p>기준 시각은 {@code now} 가 아니라 <b>요청 시각</b>이다 — 마감 대기가 길어져도
     * "그 사람이 그때 얼마나 빨리 사고 있었나" 가 흐려지지 않는다.
     */
    private TradeRiskContext.Velocity velocityOf(BaseRow base, Long tradeId, LocalDateTime requestAt) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("b", base.buyerId).addValue("s", base.sellerId)
                .addValue("pc", base.photocardId).addValue("tradeId", tradeId)
                .addValue("requestAt", requestAt);
        return jdbcTemplate.queryForObject("""
                SELECT count(*) FILTER (WHERE buyer_id = :b AND completed_at >= :requestAt - interval '10 minutes')
                           AS buyer_10m,
                       count(*) FILTER (WHERE buyer_id = :b AND completed_at >= :requestAt - interval '1 hour')
                           AS buyer_1h,
                       count(*) FILTER (WHERE seller_id = :s AND completed_at >= :requestAt - interval '10 minutes')
                           AS seller_10m,
                       count(*) FILTER (WHERE seller_id = :s AND completed_at >= :requestAt - interval '1 hour')
                           AS seller_1h,
                       count(*) FILTER (WHERE photocard_id = :pc AND completed_at >= :requestAt - interval '24 hours')
                           AS card_24h
                  FROM nft_photocard_trades
                 WHERE chain_status = 'COMPLETED' AND id <> :tradeId
                   AND completed_at >= :requestAt - interval '24 hours' AND completed_at <= :requestAt
                """, params, (rs, i) -> new TradeRiskContext.Velocity(
                rs.getInt("buyer_10m"), rs.getInt("buyer_1h"),
                rs.getInt("seller_10m"), rs.getInt("seller_1h"), rs.getInt("card_24h")));
    }

    /**
     * 구매자의 최근 기간 최대 지출과 <b>그 표본 수</b>.
     *
     * <p>건수를 같이 세는 이유: 구매 이력이 1건뿐이면 "평소 최대 지출" 이 기준선이 못 된다.
     * 그 1건이 1원이었다면 200원 거래가 200배가 되어 버린다 — 실제로 dev 에서 그런 값이 나왔다.
     */
    private SpendStats buyerSpend(Long buyerId, Long tradeId, LocalDateTime since) {
        return jdbcTemplate.queryForObject("""
                SELECT max(price) AS max_price, count(*) AS n FROM nft_photocard_trades
                 WHERE buyer_id = :b AND chain_status = 'COMPLETED' AND completed_at >= :since AND id <> :tradeId
                """, new MapSqlParameterSource().addValue("b", buyerId).addValue("since", since)
                        .addValue("tradeId", tradeId),
                (rs, i) -> new SpendStats((Long) rs.getObject("max_price"), rs.getInt("n")));
    }

    private static BaseRow readBase(ResultSet rs) throws SQLException {
        return new BaseRow(
                rs.getLong("price"),
                (Long) rs.getObject("auction_id"),
                (Long) rs.getObject("listing_id"),
                rs.getLong("photocard_id"),
                rs.getLong("design_id"),
                rs.getInt("issued_supply"),
                rs.getObject("trade_created_at", LocalDateTime.class),
                rs.getString("trade_ip"),
                rs.getString("trade_ua"),
                rs.getString("hold_type"),
                rs.getLong("seller_id"),
                rs.getString("seller_phone"),
                rs.getObject("seller_created_at", LocalDateTime.class),
                rs.getLong("buyer_id"),
                rs.getString("buyer_phone"),
                rs.getObject("buyer_created_at", LocalDateTime.class),
                rs.getString("auction_ip"),
                rs.getString("auction_ua"),
                rs.getString("listing_ip"),
                rs.getString("listing_ua"));
    }

    private record BaseRow(long price, Long auctionId, Long listingId, Long photocardId, Long designId, int issuedSupply,
                           LocalDateTime tradeCreatedAt, String tradeIp, String tradeUa, String holdType,
                           Long sellerId, String sellerPhone, LocalDateTime sellerCreatedAt,
                           Long buyerId, String buyerPhone, LocalDateTime buyerCreatedAt,
                           String auctionIp, String auctionUa, String listingIp, String listingUa) {
    }

    private record BidRow(String ip, String ua) {}
    private record SpendStats(Long max, int count) {}
    private record CardStats(boolean buyerOwned, int trades, int owners) {}
    private record PairStats(int count, boolean cycled) {}
    private record PriceStats(Long median, int samples, int buyerBuys) {}
    private record VolumeStats(int recent, int recentWithParties, int baseline) {}
    private record LoginStats(int priorOtherDevices, LocalDateTime deviceFirstLogin) {}
}
