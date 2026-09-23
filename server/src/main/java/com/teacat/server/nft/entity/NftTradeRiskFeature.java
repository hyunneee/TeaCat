package com.teacat.server.nft.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 거래 한 건의 학습용 피처 스냅샷 (AUCTION_FRAUD_DESIGN.md 14-2).
 *
 * <p><b>모든 거래가 한 줄씩 생긴다.</b> 규칙에 걸리지 않은 거래도 남긴다 — 정상 사례가 없으면 모델이
 * "정상이 무엇인지" 를 배울 수 없다. 심사 행({@link NftTradeReview})은 걸린 것만 생기고 사람이 읽는 반면,
 * 이 행은 전부 생기고 기계가 읽는다.
 *
 * <p>라벨은 여기 복사하지 않는다. {@code review} 를 통해 관리자 판정을 읽으므로, 사람이 판정을 바꾸면
 * 한 곳만 바뀐다. 심사가 없는 거래는 라벨이 "약한 정상" 이다.
 */
@Entity
@Table(name = "nft_trade_risk_features")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NftTradeRiskFeature {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trade_id", nullable = false, updatable = false)
    private NftPhotocardTrade trade;

    /** 규칙이 본 수치와 파생값. 개인정보는 들어가지 않는다 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "features", nullable = false, updatable = false, columnDefinition = "jsonb")
    private Map<String, Object> features;

    /** 규칙 결과. 신호가 없으면 빈 배열 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "signals", nullable = false, updatable = false, columnDefinition = "jsonb")
    private List<NftTradeRiskSignal> signals;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "max_severity", updatable = false, columnDefinition = "nft_review_severity")
    private NftReviewSeverity maxSeverity;

    @Column(name = "flagged", nullable = false, updatable = false)
    private boolean flagged;

    /** 심사 행이 생겼으면 그것. 통과한 거래는 null */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "review_id", updatable = false)
    private NftTradeReview review;

    @CreationTimestamp
    @Column(name = "screened_at", nullable = false, updatable = false)
    private LocalDateTime screenedAt;

    private NftTradeRiskFeature(NftPhotocardTrade trade, Map<String, Object> features,
                                List<NftTradeRiskSignal> signals, NftReviewSeverity maxSeverity,
                                boolean flagged, NftTradeReview review) {
        this.trade = trade;
        this.features = features;
        this.signals = List.copyOf(signals);
        this.maxSeverity = maxSeverity;
        this.flagged = flagged;
        this.review = review;
    }

    /** @param review 심사 행. 규칙에 걸리지 않았으면 null */
    public static NftTradeRiskFeature of(NftPhotocardTrade trade, Map<String, Object> features,
                                         List<NftTradeRiskSignal> signals, NftReviewSeverity maxSeverity,
                                         boolean flagged, NftTradeReview review) {
        return new NftTradeRiskFeature(trade, features, signals, maxSeverity, flagged, review);
    }
}
