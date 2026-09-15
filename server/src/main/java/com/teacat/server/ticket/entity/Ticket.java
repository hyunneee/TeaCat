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
import org.hibernate.annotations.Array;
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
     * 입장 시 본인 확인에 쓸 얼굴 — 예매 시점의 <b>복사본</b>이다.
     *
     * <p>🔴 <b>faces 행을 가리키지 않는다.</b> 예전에는 외래키였는데, 그러면 회원이 얼굴을
     * 지우려 할 때 "티켓이 아직 쓰고 있다" 며 DB 가 막았다 — 예매를 한 번이라도 한 회원은
     * 얼굴 삭제도 탈퇴도 못 했다. 원래 의도가 "예매 당시 얼굴을 남긴다" 였으므로, 가리키는
     * 대신 <b>베껴 둔다.</b> 원본을 지워도 이 값은 그대로다.
     *
     * <p>⚠️ 그 대가로 같은 생체정보가 <b>예매 건수만큼 복사된다.</b> 얼굴을 지우거나 탈퇴해도
     * 여기 남으므로, 파기 범위를 따질 때 faces 만 보면 안 된다 (server/CLAUDE.md 6장).
     *
     * <p>모델 버전을 함께 베끼는 이유는 대조 때문이다 — 모델이 다르면 좌표계가 달라 비교
     * 자체가 성립하지 않는다. 임베딩만 남기면 "이걸 무엇과 견줄 수 있는지" 를 알 수 없다.
     */
    @JdbcTypeCode(SqlTypes.VECTOR)
    @Array(length = Face.EMBEDDING_DIMENSION)
    @Column(name = "face_embedding", nullable = false, updatable = false)
    private float[] faceEmbedding;

    @Column(name = "face_model_version", nullable = false, updatable = false, length = 50)
    private String faceModelVersion;

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
        /* 🔴 `face` 를 그대로 들고 있지 않고 **값만 베낀다.** 참조로 남기면 회원이 얼굴을
           지울 때 이 티켓이 원본을 붙잡아 삭제를 막는다 (위 필드 주석).
           배열은 복사한다 — 같은 배열을 공유하면 원본이 바뀔 때 발권 기록도 따라 바뀐다. */
        this.faceEmbedding = face.getEmbedding().clone();
        this.faceModelVersion = face.getModelVersion();
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
