package com.teacat.server.stadium.entity;

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

import java.math.BigDecimal;

/**
 * 공연장 구역 (areas).
 *
 * 공연이 구역에 등급·가격을 매기고(API-268) 좌석을 만들어야 해서(API-269) 필요하다.
 * 공연장 도메인(API-3xx)이 붙으면 그쪽 정의로 합치면 된다.
 */
@Entity
@Table(name = "areas")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Area {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stadium_id", nullable = false)
    private Stadium stadium;

    @Column(name = "area_code", nullable = false, length = 20)
    private String areaCode;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "type", nullable = false, columnDefinition = "area_type")
    private AreaType type;

    /** 스탠딩 구역의 수용 인원. 좌석제 구역은 seats 행 수가 기준이라 비어 있을 수 있다 */
    @Column(name = "max_seat")
    private Integer maxSeat;

    @Column(name = "area_x")
    private BigDecimal areaX;

    @Column(name = "area_y")
    private BigDecimal areaY;

    @Column(name = "height")
    private BigDecimal height;

    @Column(name = "width")
    private BigDecimal width;

    public boolean isSeated() {
        return this.type == AreaType.SEATED;
    }
}
