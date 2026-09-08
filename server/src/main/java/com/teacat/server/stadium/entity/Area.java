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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stadium_layout_id", nullable = false)
    private StadiumLayout stadiumLayout;

    @Column(name = "area_code", nullable = false, length = 20)
    private String areaCode;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "type", nullable = false, columnDefinition = "area_type")
    private AreaType type;

    @Column(name = "max_seat", nullable = false)
    private int maxSeat;

    @Column(name = "area_x")
    private BigDecimal areaX;

    @Column(name = "area_y")
    private BigDecimal areaY;

    @Column(name = "height")
    private BigDecimal height;

    @Column(name = "width")
    private BigDecimal width;

    private Area(Stadium stadium, StadiumLayout stadiumLayout, String areaCode, AreaType type, int maxSeat,
                 BigDecimal areaX, BigDecimal areaY, BigDecimal height, BigDecimal width) {
        this.stadium = stadium;
        this.stadiumLayout = stadiumLayout;
        this.areaCode = areaCode;
        this.type = type;
        this.maxSeat = maxSeat;
        this.areaX = areaX;
        this.areaY = areaY;
        this.height = height;
        this.width = width;
    }

    public static Area create(Stadium stadium, StadiumLayout stadiumLayout, String areaCode, AreaType type, int maxSeat,
                              BigDecimal areaX, BigDecimal areaY, BigDecimal height, BigDecimal width) {
        return new Area(stadium, stadiumLayout, areaCode, type, maxSeat, areaX, areaY, height, width);
    }

    public void update(String areaCode, AreaType type, Integer maxSeat,
                       BigDecimal areaX, BigDecimal areaY, BigDecimal height, BigDecimal width) {
        if (areaCode != null) {
            this.areaCode = areaCode;
        }
        if (type != null) {
            this.type = type;
        }
        if (maxSeat != null) {
            this.maxSeat = maxSeat;
        }
        if (areaX != null) {
            this.areaX = areaX;
        }
        if (areaY != null) {
            this.areaY = areaY;
        }
        if (height != null) {
            this.height = height;
        }
        if (width != null) {
            this.width = width;
        }
    }
}
