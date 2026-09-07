package com.teacat.server.booking.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * performance_seats 복합 기본키 (performance_detail_id, seat_id)
 */
@Getter
@Embeddable
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PerformanceSeatId implements Serializable {

    @Column(name = "performance_detail_id", nullable = false)
    private Long performanceDetailId;

    @Column(name = "seat_id", nullable = false)
    private Long seatId;

    public PerformanceSeatId(Long performanceDetailId, Long seatId) {
        this.performanceDetailId = performanceDetailId;
        this.seatId = seatId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PerformanceSeatId that)) {
            return false;
        }
        return Objects.equals(performanceDetailId, that.performanceDetailId)
                && Objects.equals(seatId, that.seatId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(performanceDetailId, seatId);
    }
}
