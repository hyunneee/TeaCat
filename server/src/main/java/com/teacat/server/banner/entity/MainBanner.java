package com.teacat.server.banner.entity;

import com.teacat.server.performance.entity.PerformanceGeneral;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
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

import java.time.LocalDateTime;

/**
 * 메인 슬라이드.
 *
 * 만드는 방법이 둘이다.
 *   IMAGE       이미지를 직접 올리고, 누르면 갈 상대 경로를 적는다 (비우면 이동 없음)
 *   PERFORMANCE 공연을 고르면 이미지는 그 공연 포스터를 쓰고 링크는 공연 상세로 간다
 *
 * 타입마다 채우는 칸이 달라 섞이면 화면이 무엇을 그릴지 알 수 없다. DB CHECK 으로도 막아 둔다.
 */
@Entity
@Table(name = "main_banners")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MainBanner {

    public static final int TITLE_MAX_LENGTH = 60;
    public static final int SUBTITLE_MAX_LENGTH = 100;
    public static final int LABEL_MAX_LENGTH = 20;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "type", nullable = false, columnDefinition = "main_banner_type")
    private MainBannerType type;

    @Column(name = "title", nullable = false, length = TITLE_MAX_LENGTH)
    private String title;

    @Column(name = "subtitle", length = SUBTITLE_MAX_LENGTH)
    private String subtitle;

    @Column(name = "label", length = LABEL_MAX_LENGTH)
    private String label;

    /** 스토리지 key. URL 은 조회할 때 만든다 — 서명이 붙은 주소라 저장하면 곧 만료된다 */
    @Column(name = "image_key", length = 255)
    private String imageKey;

    /**
     * 그림에서 <b>보여줄 한 점</b>. 틀(폰 4:3 · 데스크톱 2:1)과 비율이 다르면 나머지가 잘린다.
     *
     * 타입과 무관하게 채운다 — 공연 배너의 3:4 포스터가 가장 많이 잘린다.
     */
    @Embedded
    private MainBannerImageFocus imageFocus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performance_general_id")
    private PerformanceGeneral performance;

    /**
     * 누르면 갈 곳. 서비스 내 경로(`/nft/draw`)이거나 외부 주소(`https://…`)다.
     *
     * <p>이름은 {@code linkPath} 지만 <b>경로만 담지 않는다</b> — 외부 주소도 들어온다.
     * 규칙은 {@code BannerWriteRequest} 의 {@code @Pattern} 하나가 지킨다.
     */
    @Column(name = "link_path", length = 500)
    private String linkPath;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(name = "active", nullable = false)
    private boolean active;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private MainBanner(MainBannerType type, String title, String subtitle, String label,
                       String imageKey, MainBannerImageFocus imageFocus, PerformanceGeneral performance,
                       String linkPath, int sortOrder, boolean active) {
        this.type = type;
        this.title = title;
        this.subtitle = subtitle;
        this.label = label;
        this.imageKey = imageKey;
        this.imageFocus = imageFocus;
        this.performance = performance;
        this.linkPath = linkPath;
        this.sortOrder = sortOrder;
        this.active = active;
    }

    /** 이미지를 직접 올려 만드는 슬라이드 */
    public static MainBanner ofImage(String title, String subtitle, String label,
                                     String imageKey, MainBannerImageFocus imageFocus,
                                     String linkPath, int sortOrder, boolean active) {
        return new MainBanner(MainBannerType.IMAGE, title, subtitle, label,
                imageKey, imageFocus, null, linkPath, sortOrder, active);
    }

    /** 공연을 지정해 만드는 슬라이드. 이미지·링크는 그 공연을 따라간다 */
    public static MainBanner ofPerformance(String title, String subtitle, String label,
                                           MainBannerImageFocus imageFocus, PerformanceGeneral performance,
                                           int sortOrder, boolean active) {
        return new MainBanner(MainBannerType.PERFORMANCE, title, subtitle, label,
                null, imageFocus, performance, null, sortOrder, active);
    }

    /** 문구는 타입과 무관하게 고칠 수 있다 */
    public void editText(String title, String subtitle, String label) {
        this.title = title;
        this.subtitle = subtitle;
        this.label = label;
    }

    /** 크롭 위치도 타입과 무관하다 — 직접 올린 그림이든 공연 포스터든 같은 틀에 담긴다 */
    public void changeImageFocus(MainBannerImageFocus imageFocus) {
        this.imageFocus = imageFocus;
    }

    /** IMAGE 로 바꾸거나, IMAGE 인 채로 이미지·링크를 고친다 */
    public void changeToImage(String imageKey, String linkPath) {
        this.type = MainBannerType.IMAGE;
        this.imageKey = imageKey;
        this.linkPath = linkPath;
        this.performance = null;
    }

    /** PERFORMANCE 로 바꾸거나, 가리키는 공연을 고친다 */
    public void changeToPerformance(PerformanceGeneral performance) {
        this.type = MainBannerType.PERFORMANCE;
        this.performance = performance;
        this.imageKey = null;
        this.linkPath = null;
    }

    public void changeActive(boolean active) {
        this.active = active;
    }

    public void changeSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public boolean isImageType() {
        return this.type == MainBannerType.IMAGE;
    }
}
