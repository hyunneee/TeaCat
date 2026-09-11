package com.teacat.server.ticket.entity;

import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.stadium.entity.Area;
import com.teacat.server.stadium.entity.Seat;
import com.teacat.server.user.entity.Face;
import com.teacat.server.user.entity.User;
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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * 예매된 티켓 한 장.
 *
 * <p>결제가 확정되는 순간 만들어집니다. <b>체인 정보는 여기 없습니다</b> — SBT 발행 상태와
 * tokenId 는 {@code nft_tickets} 가 갖고, 그 테이블은 블록체인 서비스가 직접 갱신합니다
 * ({@code com.teacat.server.nft.entity.NftTicket}).
 */
@Entity
@Table(name = "tickets")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "performance_detail_id", nullable = false, updatable = false)
    private PerformanceDetail performanceDetail;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "area_id", nullable = false, updatable = false)
    private Area area;

    /** 스탠딩이면 null */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seat_id", updatable = false)
    private Seat seat;

    /**
     * 입장 시 본인 확인에 쓸 얼굴.
     *
     * 예매 시점에 등록돼 있던 얼굴을 고정해 둔다. 나중에 회원이 얼굴을 바꿔도 이 티켓이 어떤
     * 얼굴로 발권됐는지는 남아야 한다. NOT NULL 이라 얼굴 없이는 발권되지 않는다.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "face_id", nullable = false, updatable = false)
    private Face face;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "ticket_status")
    private TicketStatus status;

    @CreationTimestamp
    @Column(name = "booked_at", nullable = false, updatable = false)
    private LocalDateTime bookedAt;

    private Ticket(User user, PerformanceDetail performanceDetail, Area area, Seat seat, Face face) {
        this.user = user;
        this.performanceDetail = performanceDetail;
        this.area = area;
        this.seat = seat;
        this.face = face;
        this.status = TicketStatus.CONFIRMED;
    }

    /**
     * 결제가 확정되어 티켓을 발권한다.
     *
     * @param seat 스탠딩이면 null
     */
    public static Ticket issue(User user, PerformanceDetail performanceDetail, Area area, Seat seat, Face face) {
        return new Ticket(user, performanceDetail, area, seat, face);
    }

    /** 예매 취소. SBT 소각은 별도로 요청한다 */
    public void cancel() {
        this.status = TicketStatus.CANCELLED;
    }

    public boolean isCancelled() {
        return status == TicketStatus.CANCELLED;
    }

    public boolean isOwnedBy(Long userId) {
        return user.getId().equals(userId);
    }
}
