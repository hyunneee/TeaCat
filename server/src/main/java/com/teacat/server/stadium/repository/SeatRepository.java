package com.teacat.server.stadium.repository;

import com.teacat.server.stadium.entity.Seat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface SeatRepository extends JpaRepository<Seat, Long> {

    List<Seat> findAllByAreaIdOrderByRowLabelAscSeatNumberAsc(Long areaId);

    @Query("SELECT s FROM Seat s JOIN FETCH s.area a JOIN FETCH a.stadium JOIN FETCH a.stadiumLayout WHERE s.id = :seatId")
    Optional<Seat> findByIdWithAreaAndStadium(Long seatId);

    long countByAreaId(Long areaId);

    boolean existsByAreaIdAndRowLabelAndSeatNumber(Long areaId, String rowLabel, int seatNumber);

    boolean existsByAreaIdAndRowLabelAndSeatNumberAndIdNot(
            Long areaId, String rowLabel, int seatNumber, Long seatId);

    @Query(value = """
            SELECT EXISTS (SELECT 1 FROM performance_seats ps WHERE ps.seat_id = :seatId)
                OR EXISTS (SELECT 1 FROM tickets t WHERE t.seat_id = :seatId)
            """, nativeQuery = true)
    boolean isInUse(Long seatId);

    @Modifying
    @Query("DELETE FROM Seat s WHERE s.area.id = :areaId")
    void deleteAllByAreaId(Long areaId);

    @Modifying
    @Query(value = """
            DELETE FROM seats
             WHERE area_id IN (SELECT id FROM areas WHERE stadium_id = :stadiumId)
            """, nativeQuery = true)
    void deleteAllByStadiumId(Long stadiumId);

    @Query(value = "SELECT COUNT(*) FROM seats s JOIN areas a ON a.id = s.area_id WHERE a.stadium_layout_id = :layoutId",
            nativeQuery = true)
    long countByLayoutId(Long layoutId);

    @Query(value = "SELECT COUNT(*) FROM seats s JOIN areas a ON a.id = s.area_id WHERE a.stadium_layout_id = :layoutId AND s.id IN (:seatIds)",
            nativeQuery = true)
    long countByLayoutIdAndIds(Long layoutId, List<Long> seatIds);

    @Modifying
    @Query(value = "DELETE FROM seats WHERE area_id IN (SELECT id FROM areas WHERE stadium_layout_id = :layoutId)",
            nativeQuery = true)
    void deleteAllByLayoutId(Long layoutId);
}
