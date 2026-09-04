package com.teacat.server.performance.repository;

import com.teacat.server.performance.entity.PerformanceDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PerformanceDetailRepository extends JpaRepository<PerformanceDetail, Long> {

    /** 공연 회차 목록 (API-202, API-204) */
    List<PerformanceDetail> findByPerformanceIdOrderByPerformanceNumAsc(Long performanceId);

    /**
     * 회차 단건 조회 (API-203, API-206).
     *
     * 공연 제목·공연장 이름·티켓팅 시각을 함께 쓰므로 한 번에 가져온다.
     *
     * 비공개 공연의 회차는 내려주지 않는다. 공연을 감췄는데
     * 회차 URL 로 우회 조회되면 감춘 의미가 없다.
     */
    @Query("""
            SELECT d FROM PerformanceDetail d
            JOIN FETCH d.performance p
            JOIN FETCH p.stadium
            WHERE d.id = :scheduleId
            """)
    Optional<PerformanceDetail> findWithPerformanceById(@Param("scheduleId") Long scheduleId);

    /**
     * 공개 상태인 공연의 회차만 (클라이언트 조회 API-203, API-206).
     *
     * 공연을 비공개로 돌렸는데 회차 URL 로 우회 조회되면 감춘 의미가 없다.
     * 관리자용(API-266, 267, 269)은 위의 findWithPerformanceById 를 써서 비공개 공연도 다룬다.
     */
    @Query("""
            SELECT d FROM PerformanceDetail d
            JOIN FETCH d.performance p
            JOIN FETCH p.stadium
            WHERE d.id = :scheduleId AND p.deletedAt IS NULL
            """)
    Optional<PerformanceDetail> findVisibleWithPerformanceById(@Param("scheduleId") Long scheduleId);

    /**
     * 이 회차에 예매 이력이 있는지 (API-267).
     *
     * 티켓 도메인 엔티티가 아직 없어 네이티브 쿼리로 확인한다. 취소된 티켓도 이력으로 본다.
     */
    @Query(value = "SELECT EXISTS (SELECT 1 FROM tickets WHERE performance_detail_id = :scheduleId)",
            nativeQuery = true)
    boolean existsTicketByScheduleId(@Param("scheduleId") Long scheduleId);

    /** 회차 삭제 전 판매 상태 행을 먼저 지운다 (FK) */
    @Modifying
    @Query(value = "DELETE FROM performance_seats WHERE performance_detail_id = :scheduleId",
            nativeQuery = true)
    void deleteSeatsByScheduleId(@Param("scheduleId") Long scheduleId);

    boolean existsByPerformanceIdAndPerformanceNum(Long performanceId, int performanceNum);

    /** 회차 등록(API-265) 시 다음 회차 번호를 정하는 데 쓴다 */
    @Query("SELECT COALESCE(MAX(d.performanceNum), 0) FROM PerformanceDetail d WHERE d.performance.id = :performanceId")
    int findMaxPerformanceNum(@Param("performanceId") Long performanceId);
}
