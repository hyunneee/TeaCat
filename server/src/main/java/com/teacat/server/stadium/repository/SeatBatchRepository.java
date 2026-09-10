package com.teacat.server.stadium.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
@RequiredArgsConstructor
public class SeatBatchRepository {

    private static final int BATCH_SIZE = 500;
    private static final String INSERT_SQL = """
            INSERT INTO seats (area_id, seat_x, seat_y, row_label, seat_number)
            VALUES (?, ?, ?, ?, ?)
            """;

    private final JdbcTemplate jdbcTemplate;

    public void insertAll(List<SeatBatchRow> seats) {
        jdbcTemplate.batchUpdate(INSERT_SQL, seats, BATCH_SIZE, (statement, seat) -> {
            statement.setLong(1, seat.areaId());
            statement.setBigDecimal(2, seat.seatX());
            statement.setBigDecimal(3, seat.seatY());
            statement.setString(4, seat.rowLabel());
            statement.setInt(5, seat.seatNumber());
        });
    }

    public record SeatBatchRow(
            Long areaId,
            BigDecimal seatX,
            BigDecimal seatY,
            String rowLabel,
            int seatNumber
    ) {
    }
}
