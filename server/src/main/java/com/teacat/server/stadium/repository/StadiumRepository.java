package com.teacat.server.stadium.repository;

import com.teacat.server.stadium.entity.Stadium;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface StadiumRepository extends JpaRepository<Stadium, Long> {

    @Query(value = """
            SELECT s.id AS "stadiumId",
                   s.name AS "name",
                   s.address AS "address",
                   s.phone AS "phone",
                   s.max_capacity AS "maxCapacity",
                   s.layout_image_key AS "layoutImageKey",
                   s.layout_width AS "layoutWidth",
                   s.layout_height AS "layoutHeight",
                   COUNT(a.id) AS "areaCount"
              FROM stadiums s
              LEFT JOIN stadium_layouts sl ON sl.stadium_id = s.id AND sl.is_default = true
              LEFT JOIN areas a ON a.stadium_layout_id = sl.id
             GROUP BY s.id, s.name, s.address, s.phone, s.max_capacity,
                      s.layout_image_key, s.layout_width, s.layout_height
             ORDER BY s.id
            """, nativeQuery = true)
    List<StadiumStats> findAllWithStats();

    @Query(value = """
            SELECT s.id AS "stadiumId",
                   s.name AS "name",
                   s.address AS "address",
                   s.phone AS "phone",
                   s.max_capacity AS "maxCapacity",
                   s.layout_image_key AS "layoutImageKey",
                   s.layout_width AS "layoutWidth",
                   s.layout_height AS "layoutHeight",
                   COUNT(a.id) AS "areaCount"
              FROM stadiums s
              LEFT JOIN stadium_layouts sl ON sl.stadium_id = s.id AND sl.is_default = true
              LEFT JOIN areas a ON a.stadium_layout_id = sl.id
             WHERE s.id = :stadiumId
             GROUP BY s.id, s.name, s.address, s.phone, s.max_capacity,
                      s.layout_image_key, s.layout_width, s.layout_height
            """, nativeQuery = true)
    Optional<StadiumStats> findWithStatsById(Long stadiumId);

    @Query(value = """
            SELECT EXISTS (
                SELECT 1
                  FROM areas a
                 WHERE a.stadium_id = :stadiumId
                   AND (a.area_x IS NOT NULL OR a.area_y IS NOT NULL
                        OR a.width IS NOT NULL OR a.height IS NOT NULL)
            ) OR EXISTS (
                SELECT 1
                  FROM seats seat
                  JOIN areas a ON a.id = seat.area_id
                 WHERE a.stadium_id = :stadiumId
                   AND (seat.seat_x IS NOT NULL OR seat.seat_y IS NOT NULL)
            )
            """, nativeQuery = true)
    boolean hasLayoutPositions(Long stadiumId);

    @Query(value = """
            SELECT EXISTS (
                SELECT 1
                  FROM areas a
                 WHERE a.stadium_id = :stadiumId
                   AND a.area_x IS NOT NULL
                   AND (a.area_x + a.width > :layoutWidth
                        OR a.area_y + a.height > :layoutHeight)
            ) OR EXISTS (
                SELECT 1
                  FROM seats seat
                  JOIN areas a ON a.id = seat.area_id
                 WHERE a.stadium_id = :stadiumId
                   AND seat.seat_x IS NOT NULL
                   AND (seat.seat_x >= :layoutWidth OR seat.seat_y >= :layoutHeight)
            )
            """, nativeQuery = true)
    boolean hasLayoutPositionsOutside(Long stadiumId, int layoutWidth, int layoutHeight);

    @Query(value = """
            SELECT EXISTS (SELECT 1 FROM performance_general pg WHERE pg.stadium_id = :stadiumId)
                OR EXISTS (
                    SELECT 1 FROM performance_areas pa
                    JOIN areas a ON a.id = pa.area_id
                    WHERE a.stadium_id = :stadiumId
                )
                OR EXISTS (
                    SELECT 1 FROM performance_seats ps
                    JOIN seats s ON s.id = ps.seat_id
                    JOIN areas a ON a.id = s.area_id
                    WHERE a.stadium_id = :stadiumId
                )
                OR EXISTS (
                    SELECT 1 FROM tickets t
                    JOIN areas a ON a.id = t.area_id
                    WHERE a.stadium_id = :stadiumId
                )
            """, nativeQuery = true)
    boolean isInUse(Long stadiumId);

    interface StadiumStats {
        Long getStadiumId();

        String getName();

        String getAddress();

        String getPhone();

        int getMaxCapacity();

        String getLayoutImageKey();

        Integer getLayoutWidth();

        Integer getLayoutHeight();

        long getAreaCount();

    }
}
