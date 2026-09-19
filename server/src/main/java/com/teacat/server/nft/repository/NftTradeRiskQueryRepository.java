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
        Long maxSpend = buyerMaxSpend(base.buyerId, tradeId, priceSince);

        return Optional.of(new TradeRiskContext(
                tradeId,
                auction ? TradeRiskContext.Source.AUCTION : TradeRiskContext.Source.LISTING,
                base.auctionId, base.listingId, base.price, base.photocardId, base.designId,
                seller, buyer, runnerUp, requestAt,
                pair.count, pair.cycled,
                price.median, price.samples,
                volume.recent, volume.recentWithParties, volume.baseline,
                base.issuedSupply, buyerOwned, price.samples, price.buyerBuys,
                firstDeposit,
                login.priorOtherDevices, login.deviceFirstLogin, maxSpend,
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

    private Long buyerMaxSpend(Long buyerId, Long tradeId, LocalDateTime since) {
        return jdbcTemplate.queryForObject("""
                SELECT max(price) FROM nft_photocard_trades
                 WHERE buyer_id = :b AND chain_status = 'COMPLETED' AND completed_at >= :since AND id <> :tradeId
                """, Map.of("b", buyerId, "since", since, "tradeId", tradeId), Long.class);
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
    private record PairStats(int count, boolean cycled) {}
    private record PriceStats(Long median, int samples, int buyerBuys) {}
    private record VolumeStats(int recent, int recentWithParties, int baseline) {}
    private record LoginStats(int priorOtherDevices, LocalDateTime deviceFirstLogin) {}
}
