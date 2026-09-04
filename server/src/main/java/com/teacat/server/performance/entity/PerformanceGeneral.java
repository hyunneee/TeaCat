package com.teacat.server.performance.entity;

import com.teacat.server.stadium.entity.Stadium;
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
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 공연 (performance_general).
 *
 * 포스터·상세 이미지는 파일 자체가 아니라 MinIO 의 key 만 저장한다.
 * 조회 URL 은 만료되므로 응답을 만들 때마다 새로 발급한다.
 *
 * 비공개(API-263)는 deleted_at 으로 처리하며, {@link SQLRestriction} 덕분에 조회에서 자동 제외된다.
 */
@Entity
@Table(name = "performance_general")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@SQLRestriction("deleted_at is null")
public class PerformanceGeneral {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stadium_id", nullable = false)
    private Stadium stadium;

    /** 이 날짜부터 목록에 노출된다 */
    @Column(name = "visible_from", nullable = false)
    private LocalDate visibleFrom;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "ticketing_start_at", nullable = false)
    private LocalDateTime ticketingStartAt;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "performance_status")
    private PerformanceStatus status;

    /** MinIO 저장 key. 예: performance/poster/2026/09/a1b2....png */
    @Column(name = "poster_img")
    private String posterImageKey;

    @Column(name = "performance_detail_img")
    private String detailImageKey;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    private PerformanceGeneral(Stadium stadium, String title, LocalDateTime ticketingStartAt,
                               LocalDate visibleFrom, String posterImageKey, String detailImageKey) {
        this.stadium = stadium;
        this.title = title;
        this.ticketingStartAt = ticketingStartAt;
        this.visibleFrom = visibleFrom;
        this.posterImageKey = posterImageKey;
        this.detailImageKey = detailImageKey;
        this.status = PerformanceStatus.UPCOMING;
    }

    /** 공연 등록 (API-261) */
    public static PerformanceGeneral create(Stadium stadium, String title, LocalDateTime ticketingStartAt,
                                            LocalDate visibleFrom, String posterImageKey, String detailImageKey) {
        return new PerformanceGeneral(stadium, title, ticketingStartAt, visibleFrom, posterImageKey, detailImageKey);
    }

    /**
     * 티켓팅이 이미 열렸는지. 오픈 이후에는 공연장·티켓팅 시각처럼
     * 예매자가 이미 보고 결정한 정보를 바꿀 수 없다 (API-262).
     */
    public boolean isTicketingStarted(LocalDateTime now) {
        return !now.isBefore(this.ticketingStartAt);
    }

    /** 공연 수정 (API-262). null 인 필드는 변경하지 않는다 */
    public void update(String title, Stadium stadium, LocalDateTime ticketingStartAt, LocalDate visibleFrom) {
        if (title != null) {
            this.title = title;
        }
        if (stadium != null) {
            this.stadium = stadium;
        }
        if (ticketingStartAt != null) {
            this.ticketingStartAt = ticketingStartAt;
        }
        if (visibleFrom != null) {
            this.visibleFrom = visibleFrom;
        }
    }

    /** 공연 비공개 (API-263). 예매 이력이 있어 물리 삭제할 수 없을 때 쓴다 */
    public void hide(LocalDateTime hiddenAt) {
        this.deletedAt = hiddenAt;
    }
}
