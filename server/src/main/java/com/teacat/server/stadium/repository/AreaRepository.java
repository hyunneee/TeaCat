package com.teacat.server.stadium.repository;

import com.teacat.server.stadium.entity.Area;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface AreaRepository extends JpaRepository<Area, Long> {

    List<Area> findByStadiumId(Long stadiumId);

    @Query(value = """
            SELECT a.id AS "areaId",
                   a.stadium_id AS "stadiumId",
                   a.area_code AS "areaCode",
                   a.level_code AS "levelCode",
                   CAST(a.type AS text) AS "type",
                   a.max_seat AS "maxSeat",
                   a.area_x AS "areaX",
                   a.area_y AS "areaY",
                   a.height AS "height",
                   a.width AS "width",
                   COUNT(s.id) AS "seatCount"
              FROM areas a
              LEFT JOIN seats s ON s.area_id = a.id
              JOIN stadium_layouts sl ON sl.id = a.stadium_layout_id
             WHERE a.stadium_id = :stadiumId
               AND sl.is_default = true
             GROUP BY a.id, a.stadium_id, a.area_code, a.level_code, a.type, a.max_seat,
                      a.area_x, a.area_y, a.height, a.width
             ORDER BY a.level_code, a.area_code, a.id
            """, nativeQuery = true)
    List<AreaStats> findAllWithStatsByStadiumId(Long stadiumId);

    @Query(value = """
            SELECT a.id AS "areaId",
                   a.stadium_id AS "stadiumId",
                   a.area_code AS "areaCode",
                   a.level_code AS "levelCode",
                   CAST(a.type AS text) AS "type",
                   a.max_seat AS "maxSeat",
                   a.area_x AS "areaX",
                   a.area_y AS "areaY",
                   a.height AS "height",
                   a.width AS "width",
                   COUNT(s.id) AS "seatCount"
              FROM areas a
              LEFT JOIN seats s ON s.area_id = a.id
             WHERE a.stadium_layout_id = :layoutId
             GROUP BY a.id, a.stadium_id, a.area_code, a.level_code, a.type, a.max_seat,
                      a.area_x, a.area_y, a.height, a.width
             ORDER BY a.level_code, a.area_code, a.id
            """, nativeQuery = true)
    List<AreaStats> findAllWithStatsByLayoutId(Long layoutId);

    @Query(value = """
            SELECT a.id AS "areaId",
                   a.stadium_id AS "stadiumId",
                   a.area_code AS "areaCode",
                   a.level_code AS "levelCode",
                   CAST(a.type AS text) AS "type",
                   a.max_seat AS "maxSeat",
                   a.area_x AS "areaX",
                   a.area_y AS "areaY",
                   a.height AS "height",
                   a.width AS "width",
                   COUNT(s.id) AS "seatCount"
              FROM areas a
              LEFT JOIN seats s ON s.area_id = a.id
             WHERE a.id = :areaId
             GROUP BY a.id, a.stadium_id, a.area_code, a.level_code, a.type, a.max_seat,
                      a.area_x, a.area_y, a.height, a.width
            """, nativeQuery = true)
    Optional<AreaStats> findWithStatsById(Long areaId);

    @Query("SELECT a FROM Area a JOIN FETCH a.stadium JOIN FETCH a.stadiumLayout WHERE a.id = :areaId")
    Optional<Area> findByIdWithStadium(Long areaId);

    boolean existsByStadiumIdAndAreaCode(Long stadiumId, String areaCode);

    boolean existsByStadiumIdAndAreaCodeAndIdNot(Long stadiumId, String areaCode, Long areaId);

    boolean existsByStadiumLayoutIdAndLevelCodeAndAreaCode(Long layoutId, String levelCode, String areaCode);

    boolean existsByStadiumLayoutIdAndLevelCodeAndAreaCodeAndIdNot(
            Long layoutId, String levelCode, String areaCode, Long areaId);

    long countByStadiumLayoutId(Long layoutId);

    List<Area> findAllByStadiumLayoutIdOrderByLevelCodeAscAreaCodeAsc(Long layoutId);

    @Modifying
    void deleteAllByStadiumLayoutId(Long layoutId);

    @Query(value = """
            SELECT EXISTS (SELECT 1 FROM performance_areas pa WHERE pa.area_id = :areaId)
                OR EXISTS (SELECT 1 FROM tickets t WHERE t.area_id = :areaId)
                OR EXISTS (
                    SELECT 1 FROM performance_seats ps
                    JOIN seats s ON s.id = ps.seat_id
                    WHERE s.area_id = :areaId
                )
                OR EXISTS (
                    SELECT 1 FROM tickets t
                    JOIN seats s ON s.id = t.seat_id
                    WHERE s.area_id = :areaId
                )
            """, nativeQuery = true)
    boolean isInUse(Long areaId);

    @Modifying
    @Query("DELETE FROM Area a WHERE a.stadium.id = :stadiumId")
    void deleteAllByStadiumId(Long stadiumId);

    interface AreaStats {
        Long getAreaId();

        Long getStadiumId();

        String getAreaCode();

        String getLevelCode();

        String getType();

        int getMaxSeat();

        BigDecimal getAreaX();

        BigDecimal getAreaY();

        BigDecimal getHeight();

        BigDecimal getWidth();

        long getSeatCount();
    }
}
