package com.teacat.server.performance.entity;

import com.teacat.server.stadium.entity.Stadium;
import com.teacat.server.stadium.entity.StadiumLayout;
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
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 공연 (performance_general).
 *
 * 포스터·상세 이미지는 파일 자체가 아니라 MinIO 의 key 만 저장한다.
 * 조회 URL 은 만료되므로 응답을 만들 때마다 새로 발급한다.
 *
 * 비공개는 hidden_at 으로 표시한다 (API-271). 삭제(API-263)는 행을 실제로 지우는 하드 삭제라
 * 비공개와는 다른 동작이고, 그래서 컬럼도 따로 둔다. 소프트 삭제가 필요해지면 deleted_at 을 새로 추가한다.
 *
 * 조회에서 자동으로 빼주지 않는다 — 관리자는 비공개 공연도 봐야 하기 때문이다.
 * 클라이언트용 조회 쿼리가 hidden_at is null 조건을 직접 건다.
 */
@Entity
@Table(name = "performance_general")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PerformanceGeneral {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stadium_id", nullable = false)
    private Stadium stadium;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stadium_layout_id", nullable = false)
    private StadiumLayout stadiumLayout;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "layout_elements", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> layoutElements = emptyLayoutElements();

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

    /** 비공개로 바꾼 시각. null 이면 공개 상태다 */
    @Column(name = "hidden_at")
    private LocalDateTime hiddenAt;

    /**
     * 등록한 관리자(users.id). 관리자 API 는 등록자 본인만 쓸 수 있다.
     * 회원 엔티티를 연관관계로 걸지 않고 id 만 둔다 — 여기서 회원 정보를 읽을 일이 없고,
     * 공연 조회마다 회원 테이블을 끌고 오지 않기 위함이다.
     */
    @Column(name = "created_by")
    private Long createdById;

    private PerformanceGeneral(Stadium stadium, StadiumLayout stadiumLayout,
                               String title, LocalDateTime ticketingStartAt,
                               LocalDate visibleFrom, String posterImageKey, String detailImageKey,
                               Long createdById) {
        this.stadium = stadium;
        this.stadiumLayout = stadiumLayout;
        this.title = title;
        this.ticketingStartAt = ticketingStartAt;
        this.visibleFrom = visibleFrom;
        this.posterImageKey = posterImageKey;
        this.detailImageKey = detailImageKey;
        this.createdById = createdById;
        this.status = PerformanceStatus.UPCOMING;
    }

    /** 공연 등록 (API-261) */
    public static PerformanceGeneral create(Stadium stadium, StadiumLayout stadiumLayout,
                                            String title, LocalDateTime ticketingStartAt,
                                            LocalDate visibleFrom, String posterImageKey, String detailImageKey,
                                            Long createdById) {
        return new PerformanceGeneral(stadium, stadiumLayout, title, ticketingStartAt,
                visibleFrom, posterImageKey, detailImageKey, createdById);
    }

    /** Unit-test/legacy fixture compatibility. New persisted performances must use the layout-aware factory. */
    public static PerformanceGeneral create(Stadium stadium, String title, LocalDateTime ticketingStartAt,
                                            LocalDate visibleFrom, String posterImageKey, String detailImageKey,
                                            Long createdById) {
        return create(stadium, null, title, ticketingStartAt, visibleFrom,
                posterImageKey, detailImageKey, createdById);
    }

    /** Layout-domain fixture compatibility. */
    public static PerformanceGeneral create(Stadium stadium, StadiumLayout stadiumLayout,
                                            String title, LocalDateTime ticketingStartAt,
                                            LocalDate visibleFrom, String posterImageKey, String detailImageKey) {
        return create(stadium, stadiumLayout, title, ticketingStartAt, visibleFrom,
                posterImageKey, detailImageKey, null);
    }

    /**
     * 이 사용자가 등록한 공연인지. 등록자가 없는(NULL) 공연은 누구의 것도 아니다.
     * 마이그레이션 이전 데이터가 그렇고, 실수로 다른 관리자의 공연을 건드리는 것보다 거절이 안전하다.
     */
    public boolean isOwnedBy(Long userId) {
        return this.createdById != null && this.createdById.equals(userId);
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

    /** 이미지 교체 (API-262). null 인 쪽은 그대로 둔다 */
    public void replaceImages(String posterImageKey, String detailImageKey) {
        if (posterImageKey != null) {
            this.posterImageKey = posterImageKey;
        }
        if (detailImageKey != null) {
            this.detailImageKey = detailImageKey;
        }
    }

    /**
     * 공연 상태 전환 (API-264).
     *
     * 허용되지 않는 전이인지는 호출 쪽에서 {@link PerformanceStatus#canTransitionTo} 로 먼저 걸러야 한다.
     * 여기서는 규칙을 다시 검사하지 않고 그대로 바꾼다.
     */
    public void changeStatus(PerformanceStatus status) {
        this.status = status;
    }

    /** 공연 비공개 (API-271). 목록·상세에서 감추되 데이터는 남긴다 */
    public void hide(LocalDateTime hiddenAt) {
        this.hiddenAt = hiddenAt;
    }

    /** 공연 공개 (API-271). 비공개를 되돌린다 */
    public void show() {
        this.hiddenAt = null;
    }

    public boolean isHidden() {
        return this.hiddenAt != null;
    }

    public void updateLayout(StadiumLayout stadiumLayout, List<Map<String, Object>> elements,
                             List<Long> blockedSeatIds) {
        this.stadiumLayout = stadiumLayout;
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("elements", elements == null ? List.of() : elements);
        value.put("blockedSeatIds", blockedSeatIds == null ? List.of() : blockedSeatIds);
        this.layoutElements = value;
    }

    private static Map<String, Object> emptyLayoutElements() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("elements", List.of());
        value.put("blockedSeatIds", List.of());
        return value;
    }
}
