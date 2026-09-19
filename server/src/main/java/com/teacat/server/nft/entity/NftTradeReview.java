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
 * 이상거래 심사 한 건. 거래 하나에 최대 하나다.
 *
 * <p>거래 행이 무엇을·누가·얼마에·어떤 홀드로 사는지 전부 들고 있으므로, 여기는 "왜 걸렸나(signals)",
 * "AI 가 무엇이라 했나(analysis)", "사람이 어떻게 정했나(decision)" 만 갖는다.
 * 결정은 한 번뿐이다 — decision 이 null 인 동안만 승인·거절할 수 있다.
 */
@Entity
@Table(name = "nft_trade_reviews")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NftTradeReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trade_id", nullable = false, updatable = false)
    private NftPhotocardTrade trade;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "signals", nullable = false, updatable = false, columnDefinition = "jsonb")
    private List<NftTradeRiskSignal> signals;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "max_severity", nullable = false, updatable = false, columnDefinition = "nft_review_severity")
    private NftReviewSeverity maxSeverity;

    /** 보류 기준(HIGH 1개 또는 MEDIUM 2개)을 넘었나. 신호가 하나라도 있으면 행이 생기므로 따로 둔다 */
    @Column(name = "flagged", nullable = false, updatable = false)
    private boolean flagged;

    /** 실제로 정산을 멈췄나(HOLD 모드). true 면 결정이 돈을 움직이고, false 면 판정 기록만 남는다 */
    @Column(name = "held", nullable = false, updatable = false)
    private boolean held;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "analysis_status", nullable = false, columnDefinition = "nft_review_analysis_status")
    private NftReviewAnalysisStatus analysisStatus;

    /** AI 분석 보고서(설계 문서 7-3 스키마). 분석 전·실패면 null */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "analysis", columnDefinition = "jsonb")
    private Map<String, Object> analysis;

    @Column(name = "analysis_model", length = 64)
    private String analysisModel;

    @Column(name = "analysis_attempts", nullable = false)
    private int analysisAttempts;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "decision", columnDefinition = "nft_review_decision")
    private NftReviewDecision decision;

    /** users.id. null 이면 시한 경과 자동 승인 */
    @Column(name = "decided_by")
    private Long decidedBy;

    @Column(name = "decision_note")
    private String decisionNote;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    private NftTradeReview(NftPhotocardTrade trade, List<NftTradeRiskSignal> signals, NftReviewSeverity maxSeverity,
                           boolean flagged, boolean held) {
        this.trade = trade;
        this.signals = List.copyOf(signals);
        this.maxSeverity = maxSeverity;
        this.flagged = flagged;
        this.held = held;
        this.analysisStatus = NftReviewAnalysisStatus.PENDING;
    }

    /**
     * @param flagged 보류 기준을 넘었나
     * @param held    정산을 실제로 멈췄나. FLAG 모드면 flagged 여도 false
     */
    public static NftTradeReview open(NftPhotocardTrade trade, List<NftTradeRiskSignal> signals,
                                      NftReviewSeverity maxSeverity, boolean flagged, boolean held) {
        return new NftTradeReview(trade, signals, maxSeverity, flagged, held);
    }

    public boolean isDecided() {
        return decision != null;
    }

    /** @param adminId null 이면 시한 경과 자동 승인 */
    public void approve(Long adminId, String note, LocalDateTime now) {
        decide(NftReviewDecision.APPROVED, adminId, note, now);
    }

    public void reject(Long adminId, String note, LocalDateTime now) {
        decide(NftReviewDecision.REJECTED, adminId, note, now);
    }

    private void decide(NftReviewDecision decision, Long adminId, String note, LocalDateTime now) {
        this.decision = decision;
        this.decidedBy = adminId;
        this.decisionNote = note;
        this.decidedAt = now;
    }

    public void analysisDone(Map<String, Object> analysis, String model) {
        this.analysis = analysis;
        this.analysisModel = model;
        this.analysisStatus = NftReviewAnalysisStatus.DONE;
    }

    /** @return 이번 실패로 한도를 넘어 FAILED 가 됐으면 true */
    public boolean analysisFailed(int maxAttempts) {
        this.analysisAttempts++;
        if (this.analysisAttempts >= maxAttempts) {
            this.analysisStatus = NftReviewAnalysisStatus.FAILED;
            return true;
        }
        return false;
    }

    public void analysisSkipped(String reason) {
        this.analysisStatus = NftReviewAnalysisStatus.SKIPPED;
        this.analysis = reason == null ? null : Map.of("skippedReason", reason);
    }

    public boolean isAutoApproved() {
        return decision == NftReviewDecision.APPROVED && decidedBy == null;
    }
}
