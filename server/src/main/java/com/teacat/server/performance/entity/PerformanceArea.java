package com.teacat.server.performance.entity;

import com.teacat.server.stadium.entity.Area;
import com.teacat.server.stadium.entity.AreaType;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.AccessLevel;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * 공연 구역 등급·가격 (performance_areas).
 *
 * 같은 공연장이라도 공연마다 등급과 가격이 다르므로 (공연 × 구역) 단위로 잡는다.
 * ERD 상 회차가 아니라 <b>공연</b> 단위다 — 회차별로 가격이 다르지 않다는 전제다.
 */
@Entity
@Table(name = "performance_areas")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PerformanceArea {

    @EmbeddedId
    private PerformanceAreaId id;

    @MapsId("performanceGeneralId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performance_general_id", nullable = false)
    private PerformanceGeneral performance;

    @MapsId("areaId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "area_id", nullable = false)
    private Area area;

    /** VIP, R, S … 서비스마다 자유롭게 쓰는 문자열이다 */
    @Column(name = "grade", length = 20)
    private String grade;

    @Column(name = "price")
    private Integer price;

    /** 이 구역에서 팔 최대 수량. 스탠딩처럼 좌석이 없는 구역에서 특히 필요하다 */
    @Column(name = "max_cnt")
    private Integer maxCnt;

    /**
     * 이 공연에서 이 구역을 파는 방식.
     *
     * <p>공연장 구역의 형태(area.type)와 다를 수 있다 — 같은 플로어를 이번 공연은 스탠딩으로,
     * 다음 공연은 좌석제로 파는 일이 흔하다. 좌석 생성(API-269)과 좌석맵은 이 값을 본다.
     *
     * <p>반대 방향은 성립하지 않는다: 스탠딩 구역에는 좌석 좌표가 없어 좌석제로 팔 수 없다.
     */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "sale_type", nullable = false, columnDefinition = "area_type")
    private AreaType saleType;

    private PerformanceArea(PerformanceGeneral performance, Area area, String grade, Integer price, Integer maxCnt,
                            AreaType saleType) {
        this.id = new PerformanceAreaId(performance.getId(), area.getId());
        this.performance = performance;
        this.area = area;
        this.grade = grade;
        this.price = price;
        this.maxCnt = maxCnt;
        this.saleType = saleType;
    }

    /** 공연 구역 등급·가격 설정 (API-268) */
    public static PerformanceArea create(PerformanceGeneral performance, Area area,
                                         String grade, Integer price, Integer maxCnt, AreaType saleType) {
        return new PerformanceArea(performance, area, grade, price, maxCnt, saleType);
    }

    /** 기존 구역의 등급·가격·최대 수량·판매 방식을 갱신한다 (API-268 재저장) */
    public void updateSetting(String grade, Integer price, Integer maxCnt, AreaType saleType) {
        this.grade = grade;
        this.price = price;
        this.maxCnt = maxCnt;
        this.saleType = saleType;
    }

    /** 이 공연에서 좌석을 지정해 파는 구역인가. 좌석 생성·좌석맵이 이 값으로 대상을 고른다 */
    public boolean isSoldAsSeated() {
        return this.saleType == AreaType.SEATED;
    }

    /** 이미 팔린 수량보다 적게 최대 수량을 줄이면 CHECK 제약에 걸린다 */
    /**
     * 새 최대 수량이 이미 판 수량보다 적은가.
     *
     * <p>판매량은 티켓에서 세어 넘긴다 — 예전에는 이 엔티티가 sold_cnt 를 들고 있었지만
     * 그 값을 갱신하는 코드가 없어 늘 0 이었고, 그래서 이 검사가 무력했다.
     */
    public boolean wouldBreakSoldCount(Integer newMaxCnt, long soldCount) {
        return newMaxCnt != null && newMaxCnt < soldCount;
    }

    @Embeddable
    @Getter
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    @EqualsAndHashCode
    public static class PerformanceAreaId implements Serializable {

        @Column(name = "performance_general_id")
        private Long performanceGeneralId;

        @Column(name = "area_id")
        private Long areaId;

        public PerformanceAreaId(Long performanceGeneralId, Long areaId) {
            this.performanceGeneralId = performanceGeneralId;
            this.areaId = areaId;
        }
    }
}
