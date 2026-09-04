package com.teacat.server.performance.entity;

import com.teacat.server.stadium.entity.Seat;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 회차별 좌석 판매 상태 (performance_seats).
 *
 * seats 는 공연장 배치도(고정)이고, 이 테이블은 <b>회차마다</b> 그 좌석이 팔렸는지를 든다.
 * 같은 좌석이 1회차는 SOLD, 2회차는 AVAILABLE 일 수 있다.
 */
@Entity
@Table(name = "performance_seats")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PerformanceSeat {

    @EmbeddedId
    private PerformanceSeatId id;

    @MapsId("performanceDetailId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performance_detail_id", nullable = false)
    private PerformanceDetail performanceDetail;

    @MapsId("seatId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seat_id", nullable = false)
    private Seat seat;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "seat_booking_status")
    private SeatBookingStatus status;

    /** HELD 상태일 때만 값이 있다 (users.id) */
    @Column(name = "held_by")
    private Long heldBy;

    /** 결제 제한시각. 이 시각이 지나면 자동 해제 대상이다 */
    @Column(name = "held_until")
    private LocalDateTime heldUntil;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private PerformanceSeat(PerformanceDetail performanceDetail, Seat seat) {
        this.id = new PerformanceSeatId(performanceDetail.getId(), seat.getId());
        this.performanceDetail = performanceDetail;
        this.seat = seat;
        this.status = SeatBookingStatus.AVAILABLE;
    }

    /** 회차 좌석 생성 (API-269) */
    public static PerformanceSeat create(PerformanceDetail performanceDetail, Seat seat) {
        return new PerformanceSeat(performanceDetail, seat);
    }

    @Embeddable
    @Getter
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    @EqualsAndHashCode
    public static class PerformanceSeatId implements Serializable {

        @Column(name = "performance_detail_id")
        private Long performanceDetailId;

        @Column(name = "seat_id")
        private Long seatId;

        public PerformanceSeatId(Long performanceDetailId, Long seatId) {
            this.performanceDetailId = performanceDetailId;
            this.seatId = seatId;
        }
    }
}
