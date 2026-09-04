package com.teacat.server.performance.entity;

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
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * 공연 회차 (performance_details).
 *
 * 예매 오픈 상태는 여기에 저장하지 않는다. status 와 부모 공연의 티켓팅 시각을 조합해 계산한다.
 */
@Entity
@Table(name = "performance_details")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PerformanceDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performance_general_id", nullable = false)
    private PerformanceGeneral performance;

    /** 공연 안에서의 회차 번호 (1회차, 2회차 …) */
    @Column(name = "performance_num", nullable = false)
    private int performanceNum;

    @Column(name = "performance_date", nullable = false)
    private LocalDateTime performanceDate;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "ticketing_status")
    private TicketingStatus status;

    private PerformanceDetail(PerformanceGeneral performance, int performanceNum, LocalDateTime performanceDate) {
        this.performance = performance;
        this.performanceNum = performanceNum;
        this.performanceDate = performanceDate;
        this.status = TicketingStatus.SCHEDULED;
    }

    /** 회차 수정 (API-266). null 인 필드는 그대로 둔다 */
    public void update(LocalDateTime performanceDate, TicketingStatus status) {
        if (performanceDate != null) {
            this.performanceDate = performanceDate;
        }
        if (status != null) {
            this.status = status;
        }
    }

    /** 회차 등록 (API-265) */
    public static PerformanceDetail create(PerformanceGeneral performance, int performanceNum,
                                           LocalDateTime performanceDate) {
        return new PerformanceDetail(performance, performanceNum, performanceDate);
    }

    /**
     * 지금 이 회차를 예매할 수 있는 상태인지 계산한다 (API-206).
     *
     * 판매를 닫았거나 공연이 지났으면 CLOSED, 매진이면 SOLDOUT 이 우선한다.
     * 그 외에는 부모 공연의 티켓팅 시각과 현재 시각을 비교한다.
     */
    public BookingOpenStatus bookingStatus(LocalDateTime now) {
        if (status == TicketingStatus.CLOSED || performanceDate.isBefore(now)) {
            return BookingOpenStatus.CLOSED;
        }
        if (status == TicketingStatus.SOLD_OUT) {
            return BookingOpenStatus.SOLDOUT;
        }
        if (!performance.isTicketingStarted(now)) {
            return BookingOpenStatus.BEFORE;
        }

        return BookingOpenStatus.OPEN;
    }

    public boolean isBookable(LocalDateTime now) {
        return bookingStatus(now) == BookingOpenStatus.OPEN;
    }
}
