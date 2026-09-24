package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftTradeReviewProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.response.NftAdminTradePageResponse;
import com.teacat.server.nft.dto.response.NftTradeReviewDetailResponse;
import com.teacat.server.nft.dto.response.NftTradeReviewPageResponse;
import com.teacat.server.nft.dto.response.NftTradeReviewStatsResponse;
import com.teacat.server.nft.dto.response.NftTradeReviewSummaryResponse;
import com.teacat.server.nft.entity.NftAuction;
import com.teacat.server.nft.entity.NftPhotocardListing;
import com.teacat.server.nft.entity.NftPhotocardTrade;
import com.teacat.server.nft.entity.NftReviewDecision;
import com.teacat.server.nft.entity.NftReviewSeverity;
import com.teacat.server.nft.entity.NftTradeChainStatus;
import com.teacat.server.nft.entity.NftTradeReview;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftPhotocardTradeRepository;
import com.teacat.server.nft.repository.NftTradeReviewQueryRepository;
import com.teacat.server.nft.repository.NftTradeReviewRepository;
import com.teacat.server.nft.repository.NftTradeRiskFeatureRepository;
import com.teacat.server.user.entity.User;
import com.teacat.server.wallet.entity.CatMoneyHold;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import com.teacat.server.wallet.repository.CatMoneyHoldRepository;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

/**
 * 이상거래 심사의 관리자 결정 (AUCTION_FRAUD_DESIGN.md 8장) 과 화면 조회.
 *
 * <ul>
 *   <li><b>승인</b> — 거래를 PENDING 으로 되돌리고 심사 시각을 찍는다. 정산 코드는 부르지 않는다. 다음 주기에
 *       정산 스케줄러가 집어 기존 단계를 그대로 밟는다. 정산 로직은 프로세서 한 곳에만 있다.</li>
 *   <li><b>거절</b> — 구매자·판매자 홀드를 풀고 출처(경매·리스팅)를 복구하고 거래를 FAILED(RISK_REJECTED) 로 끝낸다.
 *       {@code NftTradeSettlementWriter.abortBeforePayment} 와 같은 일이다. 카드는 건드리지 않는다 — 아직 판매자 소유다.</li>
 *   <li><b>시한 자동 승인</b> — 관리자가 안 봐서 사용자 돈이 영영 묶이는 쪽이 오탐보다 흔한 사고라 승인으로 둔다.</li>
 * </ul>
 * 결정은 한 번뿐이다. 심사 행과 거래 행을 함께 잠가 동시 클릭을 줄 세운다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NftTradeReviewService {

    private static final int APPEARANCE_WINDOW_DAYS = 90;
    private static final int STATS_WINDOW_DAYS = 30;
    /** 관리자 화면에 보여줄 기여 피처 수. 더 늘리면 읽히지 않는다 */
    private static final int EXPLAIN_FACTORS = 5;
    private static final int RECENT_TRADES = 10;
    private static final int MAX_PAGE_SIZE = 100;

    private final NftTradeReviewRepository reviewRepository;
    private final NftTradeReviewQueryRepository queryRepository;
    private final NftPhotocardTradeRepository tradeRepository;
    private final CatMoneyHoldRepository holdRepository;
    private final CatMoneyHoldService holdService;
    private final NftTradeReviewProperties properties;
    private final NftTradeRiskFeatureRepository featureRepository;
    private final TradeRiskModelScorer modelScorer;

    public enum ListStatus { OPEN, DECIDED }

    /** 관리자 거래 내역 필터. 체인 상태 열 개를 관리자가 보는 네 묶음으로 접는다 */
    public enum TradeFilter {
        ALL(null),
        /** 이상거래 심사 대기 */
        REVIEW(List.of("RISK_REVIEW")),
        /** 체인 전송이 진행 중(보상 포함) */
        IN_PROGRESS(List.of("PENDING", "CAT_SUBMITTED", "CAT_CONFIRMED", "NFT_SUBMITTED",
                "COMPENSATING", "REFUND_SUBMITTED")),
        COMPLETED(List.of("COMPLETED")),
        /** 실패·보상 완료·운영 확인 필요 */
        FAILED(List.of("FAILED", "COMPENSATED", "MANUAL_REVIEW"));

        private final List<String> statuses;

        TradeFilter(List<String> statuses) {
            this.statuses = statuses;
        }

        List<String> statuses() {
            return statuses;
        }
    }

    public NftAdminTradePageResponse listTrades(TradeFilter filter, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        TradeFilter effective = filter == null ? TradeFilter.ALL : filter;
        List<NftAdminTradePageResponse.Trade> trades = queryRepository
                .findTrades(effective.statuses(), safePage * safeSize, safeSize).stream()
                .map(r -> new NftAdminTradePageResponse.Trade(
                        r.tradeId(),
                        r.auctionId() != null ? NftTradeReviewSummaryResponse.TradeSource.AUCTION
                                : NftTradeReviewSummaryResponse.TradeSource.LISTING,
                        r.auctionId(), r.listingId(), r.photocardId(), r.designName(), r.imageUrl(),
                        r.sellerId(), r.sellerNickname(), r.buyerId(), r.buyerNickname(),
                        r.price(), NftTradeChainStatus.valueOf(r.chainStatus()), r.failureCode(),
                        r.createdAt(), r.completedAt(), r.reviewId(),
                        r.reviewDecision() == null ? null : NftReviewDecision.valueOf(r.reviewDecision()),
                        r.reviewSeverity() == null ? null : NftReviewSeverity.valueOf(r.reviewSeverity()),
                        r.reviewHeld(), r.modelScore()))
                .toList();
        return NftAdminTradePageResponse.of(trades, safePage, safeSize, queryRepository.countTrades(effective.statuses()));
    }

    public NftTradeReviewPageResponse list(ListStatus status, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE));
        Page<NftTradeReview> reviews = status == ListStatus.DECIDED
                ? reviewRepository.findByDecisionIsNotNullOrderByDecidedAtDesc(pageable)
                : reviewRepository.findByDecisionIsNullOrderByCreatedAtAsc(pageable);
        return NftTradeReviewPageResponse.from(reviews.map(this::summary));
    }

    public NftTradeReviewDetailResponse get(Long reviewId) {
        NftTradeReview review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.TRADE_REVIEW_NOT_FOUND));
        NftPhotocardTrade trade = review.getTrade();
        NftAuction auction = trade.getAuction();
        NftPhotocardListing listing = trade.getListing();

        String sellerIp = auction != null ? auction.getClientIp() : listing != null ? listing.getClientIp() : null;
        String sellerUa = auction != null ? auction.getUserAgentHash()
                : listing != null ? listing.getUserAgentHash() : null;

        List<NftTradeReviewQueryRepository.BidRow> bidRows = auction == null
                ? List.of() : queryRepository.findBids(auction.getId());

        // 구매자 단말: 자연 낙찰은 최고 입찰 행, 즉시구매·고정가는 거래 행
        String buyerIp = trade.getClientIp();
        String buyerUa = trade.getUserAgentHash();
        if (trade.getPaymentHoldRefType() == CatMoneyHoldRefType.AUCTION_BID) {
            NftTradeReviewQueryRepository.BidRow top = bidRows.stream()
                    .filter(b -> Objects.equals(b.bidderId(), trade.getBuyer().getId()))
                    .max((a, b) -> Long.compare(a.amount(), b.amount())).orElse(null);
            if (top != null) {
                buyerIp = top.clientIp();
                buyerUa = top.userAgentHash();
            }
        }
        Boolean sameIp = sellerIp == null || buyerIp == null ? null : sellerIp.equals(buyerIp);
        Boolean sameUa = sellerUa == null || buyerUa == null ? null : sellerUa.equals(buyerUa);

        List<NftTradeReviewDetailResponse.Bid> bids = bidRows.stream().map(b -> new NftTradeReviewDetailResponse.Bid(
                b.bidId(), b.bidderId(), b.nickname(), b.amount(), b.createdAt(),
                sellerIp == null || b.clientIp() == null ? null : sellerIp.equals(b.clientIp()),
                sellerIp == null || sellerUa == null || b.clientIp() == null || b.userAgentHash() == null ? null
                        : sellerIp.equals(b.clientIp()) && sellerUa.equals(b.userAgentHash()))).toList();

        Long sellerId = trade.getSeller().getId();
        Long buyerId = trade.getBuyer().getId();
        List<NftTradeReviewDetailResponse.RecentTrade> recent = queryRepository
                .findRecentDesignTrades(trade.getPhotocard().getDesign().getId(), trade.getId(), RECENT_TRADES)
                .stream().map(r -> new NftTradeReviewDetailResponse.RecentTrade(r.tradeId(), r.price(), r.completedAt(),
                        Objects.equals(r.sellerId(), sellerId) || Objects.equals(r.buyerId(), sellerId)
                                || Objects.equals(r.sellerId(), buyerId) || Objects.equals(r.buyerId(), buyerId)))
                .toList();

        LocalDateTime appearanceSince = LocalDateTime.now().minusDays(APPEARANCE_WINDOW_DAYS);
        return new NftTradeReviewDetailResponse(
                summary(review),
                review.getSignals(),
                review.getAnalysis(),
                review.getAnalysisModel(),
                modelInsight(trade.getId()),
                review.getDecidedBy(),
                review.getDecisionNote(),
                sameIp, sameUa,
                partyDetail(trade.getSeller(), sellerIp, appearanceSince),
                partyDetail(trade.getBuyer(), buyerIp, appearanceSince),
                bids,
                recent);
    }

    /**
     * 섀도우 모델의 판단과 근거. 점수가 없으면 빈 값이다.
     *
     * <p>🔴 근거는 <b>지금 적재된 모델로 다시 계산</b>한다. 채점 당시와 모델이 다르면 설명이
     * 저장된 점수와 어긋나므로, 그때는 근거를 비우고 {@code staleModel} 로 알린다 —
     * 맞지 않는 설명을 보여주는 것보다 없는 편이 낫다.
     */
    private NftTradeReviewDetailResponse.ModelInsight modelInsight(Long tradeId) {
        return featureRepository.findByTradeId(tradeId)
                .filter(f -> f.getModelScore() != null)
                .map(f -> {
                    boolean stale = !Objects.equals(f.getModelVersion(), modelScorer.version());
                    List<NftTradeReviewDetailResponse.Factor> factors = stale ? List.of()
                            : modelScorer.explain(f.getFeatures(), EXPLAIN_FACTORS).stream()
                            .map(c -> new NftTradeReviewDetailResponse.Factor(c.label(), c.contribution()))
                            .toList();
                    return new NftTradeReviewDetailResponse.ModelInsight(
                            f.getModelScore(), f.getModelVersion(), stale, factors);
                })
                .orElse(NftTradeReviewDetailResponse.ModelInsight.NONE);
    }

    public NftTradeReviewStatsResponse stats() {
        LocalDateTime since = LocalDateTime.now().minusDays(STATS_WINDOW_DAYS);
        NftTradeReviewQueryRepository.DecisionCounts counts = queryRepository.countDecisionsSince(since);
        return new NftTradeReviewStatsResponse(
                STATS_WINDOW_DAYS,
                queryRepository.countTradesCreatedSince(since),
                counts.total(),
                reviewRepository.countByDecisionIsNull(),
                counts.approved(), counts.rejected(), counts.autoApproved(),
                queryRepository.countRuleHitsSince(since));
    }

    /**
     * 승인. 보류(HOLD)된 심사면 정산을 재개하고, 표시만 된(FLAG) 심사면 "정상" 판정을 기록만 한다 — 돈은 이미 움직였다.
     *
     * @param adminId null 이면 시한 경과 자동 승인
     */
    @Transactional
    public void approve(Long adminId, Long reviewId, String note) {
        NftTradeReview review = lockOpen(reviewId);
        if (!review.isHeld()) {
            review.approve(adminId, note, LocalDateTime.now());
            log.info("NFT 거래 심사 정상 판정 reviewId={} by={}", reviewId, adminId);
            return;
        }
        NftPhotocardTrade trade = lockTradeUnderReview(review);
        // 있을 수 없는 상태 — 홀드는 심사 중에 아무도 건드리지 않는다. 그래도 돈이 없는 채로 정산을 재개하면 안 된다
        if (!holdActive(trade.getPaymentHoldRefType(), trade.getPaymentHoldRefId())
                || !holdActive(CatMoneyHoldRefType.NFT_TRADE_SELLER, trade.getId())) {
            throw new IllegalStateException("심사 중인 거래의 홀드가 살아 있지 않습니다 tradeId=" + trade.getId());
        }
        LocalDateTime now = LocalDateTime.now();
        trade.clearRisk(now);
        review.approve(adminId, note, now);
        log.info("NFT 거래 심사 승인 reviewId={} tradeId={} by={}", reviewId, trade.getId(),
                adminId == null ? "SYSTEM(시한 경과)" : adminId);
    }

    @Transactional
    public void reject(Long adminId, Long reviewId, String note) {
        if (!StringUtils.hasText(note)) {
            throw new BusinessException(NftErrorCode.TRADE_REVIEW_NOTE_REQUIRED);
        }
        NftTradeReview review = lockOpen(reviewId);
        LocalDateTime now = LocalDateTime.now();
        if (!review.isHeld()) {
            // 표시만 된 심사 — 거래는 이미 정산됐다. "부정" 판정을 기록만 한다 (학습 라벨). 되돌리기는 별도 기능이다
            review.reject(adminId, note.trim(), now);
            log.info("NFT 거래 심사 부정 판정 reviewId={} by={}", reviewId, adminId);
            return;
        }
        NftPhotocardTrade trade = lockTradeUnderReview(review);

        holdService.release(trade.getPaymentHoldRefType(), trade.getPaymentHoldRefId());
        holdService.release(CatMoneyHoldRefType.NFT_TRADE_SELLER, trade.getId());
        restoreSource(trade, now);
        trade.rejectByRiskReview();
        review.reject(adminId, note.trim(), now);
        log.info("NFT 거래 심사 거절 reviewId={} tradeId={} by={}", reviewId, trade.getId(), adminId);
    }

    /**
     * 시한이 지난 심사를 자동 승인한다. 유지 스위퍼가 부른다.
     *
     * @return 이번에 승인한 건수
     */
    public int autoApproveExpired(int limit) {
        LocalDateTime before = LocalDateTime.now().minus(properties.autoApproveAfter());
        List<Long> ids = reviewRepository.findOpenIdsCreatedBefore(before, PageRequest.of(0, Math.max(1, limit)));
        int approved = 0;
        for (Long id : ids) {
            try {
                approve(null, id, "시한(%s) 경과 자동 승인".formatted(properties.autoApproveAfter()));
                approved++;
            } catch (RuntimeException e) {
                // 한 건이 실패해도 다음 건을 계속한다. 실패한 건은 다음 주기에 다시 잡힌다
                log.error("NFT 거래 심사 자동 승인 실패 reviewId={}", id, e);
            }
        }
        return approved;
    }

    private NftTradeReview lockOpen(Long reviewId) {
        NftTradeReview review = reviewRepository.findByIdForUpdate(reviewId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.TRADE_REVIEW_NOT_FOUND));
        if (review.isDecided()) {
            throw new BusinessException(NftErrorCode.TRADE_REVIEW_ALREADY_DECIDED);
        }
        return review;
    }

    private NftPhotocardTrade lockTradeUnderReview(NftTradeReview review) {
        NftPhotocardTrade trade = tradeRepository.findByIdForUpdate(review.getTrade().getId())
                .orElseThrow(() -> new BusinessException(NftErrorCode.TRADE_NOT_FOUND));
        if (!trade.isUnderRiskReview()) {
            throw new BusinessException(NftErrorCode.TRADE_NOT_UNDER_REVIEW);
        }
        return trade;
    }

    private boolean holdActive(CatMoneyHoldRefType refType, Long refId) {
        return holdRepository.findByRefTypeAndRefId(refType, refId).map(CatMoneyHold::isActive).orElse(false);
    }

    /**
     * 출처 복구 — {@code NftTradeSettlementWriter.restoreSource} 와 같은 규칙이다.
     * 자연 낙찰은 유찰(winner 를 지워야 DB 제약을 지킨다), 즉시구매는 경매 재개, 고정가는 리스팅 재개.
     */
    private void restoreSource(NftPhotocardTrade trade, LocalDateTime now) {
        if (trade.getListing() != null) {
            trade.getListing().reopen();
            return;
        }
        NftAuction auction = trade.getAuction();
        if (trade.getPaymentHoldRefType() == CatMoneyHoldRefType.AUCTION_BID) {
            auction.voidSettlement(now);
        } else {
            auction.reopen();
        }
    }

    private NftTradeReviewSummaryResponse summary(NftTradeReview review) {
        NftPhotocardTrade trade = review.getTrade();
        NftAuction auction = trade.getAuction();
        var design = trade.getPhotocard().getDesign();
        LocalDateTime appearanceSince = LocalDateTime.now().minusDays(APPEARANCE_WINDOW_DAYS);
        String headline = review.getAnalysis() == null ? null
                : Objects.toString(review.getAnalysis().get("headline"), null);
        return new NftTradeReviewSummaryResponse(
                review.getId(), trade.getId(),
                auction != null ? NftTradeReviewSummaryResponse.TradeSource.AUCTION
                        : NftTradeReviewSummaryResponse.TradeSource.LISTING,
                auction == null ? null : auction.getId(),
                trade.getListing() == null ? null : trade.getListing().getId(),
                trade.getPhotocard().getId(), design.getName(), design.getImageUrl(),
                trade.getPrice(), trade.getChainStatus(),
                review.getMaxSeverity(), review.isFlagged(), review.isHeld(),
                review.getSignals().stream().map(s -> s.rule()).distinct().toList(),
                review.getAnalysisStatus(), headline,
                review.getCreatedAt(),
                review.isDecided() || !review.isHeld() ? null : review.getCreatedAt().plus(properties.autoApproveAfter()),
                review.getDecision(), review.getDecidedAt(), review.isAutoApproved(),
                party(trade.getSeller(), appearanceSince),
                party(trade.getBuyer(), appearanceSince));
    }

    private NftTradeReviewSummaryResponse.Party party(User user, LocalDateTime since) {
        return new NftTradeReviewSummaryResponse.Party(user.getId(), user.getNickname(),
                reviewRepository.countAppearances(user.getId(), since));
    }

    private NftTradeReviewDetailResponse.PartyDetail partyDetail(User user, String ip, LocalDateTime since) {
        return new NftTradeReviewDetailResponse.PartyDetail(user.getId(), user.getNickname(), user.getEmail(),
                user.getCreatedAt(), reviewRepository.countAppearances(user.getId(), since), ip);
    }
}
