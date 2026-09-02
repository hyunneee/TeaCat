package com.teacat.server.booking.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * 공연 회차별 좌석의 선점(HOLD) / 판매 상태.
 * PK = (performance_detail_id, seat_id)
 */
@Getter
@Entity
@Table(name = "performance_seats")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PerformanceSeat {

    @EmbeddedId
    private PerformanceSeatId id;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "seat_booking_status")
    private SeatBookingStatus status;

    /** users.id — HELD 상태일 때만 값 존재 */
    @Column(name = "held_by")
    private Long heldBy;

    /** 결제 제한시간, 이 시각이 지나면 자동 해제 대상 */
    @Column(name = "held_until")
    private LocalDateTime heldUntil;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    private PerformanceSeat(PerformanceSeatId id, SeatBookingStatus status, Long heldBy,
            LocalDateTime heldUntil) {
        this.id = id;
        this.status = status != null ? status : SeatBookingStatus.AVAILABLE;
        this.heldBy = heldBy;
        this.heldUntil = heldUntil;
    }

    public static PerformanceSeat available(Long performanceDetailId, Long seatId) {
        return PerformanceSeat.builder()
                .id(new PerformanceSeatId(performanceDetailId, seatId))
                .status(SeatBookingStatus.AVAILABLE)
                .build();
    }

    public Long getPerformanceDetailId() {
        return id.getPerformanceDetailId();
    }

    public Long getSeatId() {
        return id.getSeatId();
    }

    /** 좌석 선점 */
    public void hold(Long userId, LocalDateTime until) {
        this.status = SeatBookingStatus.HELD;
        this.heldBy = userId;
        this.heldUntil = until;
    }

    /** 선점 해제 (만료 / 취소) */
    public void release() {
        this.status = SeatBookingStatus.AVAILABLE;
        this.heldBy = null;
        this.heldUntil = null;
    }

    /** 결제 완료 확정 */
    public void sell() {
        this.status = SeatBookingStatus.SOLD;
        this.heldUntil = null;
    }

    public boolean isHeldExpired(LocalDateTime now) {
        return status == SeatBookingStatus.HELD
                && heldUntil != null
                && heldUntil.isBefore(now);
    }
}
