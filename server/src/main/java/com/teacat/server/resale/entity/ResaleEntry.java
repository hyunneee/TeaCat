package com.teacat.server.resale.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * 취소표 대기 신청 한 건. 구역 단위로 건다.
 *
 * <p>연관 엔티티 대신 id 만 들고 있다. 이 행은 추첨 스위퍼가 수십 건씩 잠그고 바꾸는데,
 * 그때 회원·회차·구역을 같이 끌어올 이유가 없다. 화면에 보일 이름·가격은 조회 서비스가 붙인다.
 */
@Entity
@Table(name = "resale_entries")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ResaleEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "performance_detail_id", nullable = false)
    private Long performanceDetailId;

    @Column(name = "area_id", nullable = false)
    private Long areaId;

    @Column(name = "quantity", nullable = false)
    private int quantity;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "resale_entry_status")
    private ResaleEntryStatus status;

    /** 당첨 좌석. WON 이후에만 값이 있다 */
    @Column(name = "seat_id")
    private Long seatId;

    /** 당첨된 추첨 */
    @Column(name = "seat_draw_id")
    private Long seatDrawId;

    /** 당첨 결제 기한 */
    @Column(name = "deadline_at")
    private LocalDateTime deadlineAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private ResaleEntry(Long userId, Long performanceDetailId, Long areaId, int quantity) {
        this.userId = userId;
        this.performanceDetailId = performanceDetailId;
        this.areaId = areaId;
        this.quantity = quantity;
        this.status = ResaleEntryStatus.WAITING;
    }

    public static ResaleEntry waiting(Long userId, Long performanceDetailId, Long areaId, int quantity) {
        return new ResaleEntry(userId, performanceDetailId, areaId, quantity);
    }

    public boolean isWaiting() {
        return status == ResaleEntryStatus.WAITING;
    }

    public boolean isWon() {
        return status == ResaleEntryStatus.WON;
    }

    public boolean isOwnedBy(Long userId) {
        return this.userId.equals(userId);
    }

    /** 당첨 — 좌석과 결제 기한을 받는다 */
    public void markWon(Long seatId, Long seatDrawId, LocalDateTime deadlineAt) {
        this.status = ResaleEntryStatus.WON;
        this.seatId = seatId;
        this.seatDrawId = seatDrawId;
        this.deadlineAt = deadlineAt;
    }

    public void markPurchased() {
        this.status = ResaleEntryStatus.PURCHASED;
    }

    /**
     * 당첨을 놓치거나 포기한 뒤 <b>다시 대기</b>로 돌아간다. 좌석·기한은 지운다.
     * 그 좌석은 새 추첨으로 넘어가고, 이 사람은 다음 표부터 다시 참가자가 된다.
     */
    public void returnToWaiting() {
        this.status = ResaleEntryStatus.WAITING;
        this.seatId = null;
        this.seatDrawId = null;
        this.deadlineAt = null;
    }

    public void markExpired() {
        this.status = ResaleEntryStatus.EXPIRED;
    }

    public void markForfeited() {
        this.status = ResaleEntryStatus.FORFEITED;
    }

    public void markCanceled() {
        this.status = ResaleEntryStatus.CANCELED;
    }
}
