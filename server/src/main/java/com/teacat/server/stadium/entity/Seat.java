package com.teacat.server.stadium.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

import java.math.BigDecimal;

@Entity
@Table(name = "seats")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Seat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "area_id", nullable = false)
    private Area area;

    @Column(name = "seat_x")
    private BigDecimal seatX;

    @Column(name = "seat_y")
    private BigDecimal seatY;

    @Column(name = "row_label", nullable = false, length = 10)
    private String rowLabel;

    @Column(name = "seat_number", nullable = false)
    private int seatNumber;

    public void update(String rowLabel, Integer seatNumber, BigDecimal seatX, BigDecimal seatY) {
        if (rowLabel != null) {
            this.rowLabel = rowLabel;
        }
        if (seatNumber != null) {
            this.seatNumber = seatNumber;
        }
        if (seatX != null) {
            this.seatX = seatX;
        }
        if (seatY != null) {
            this.seatY = seatY;
        }
    }
}
