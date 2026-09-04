package com.teacat.server.performance.repository;

import com.teacat.server.performance.entity.PerformanceDetail;
import org.springframework.data.jpa.repository.JpaRepository;
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
     */
    @Query("""
            SELECT d FROM PerformanceDetail d
            JOIN FETCH d.performance p
            JOIN FETCH p.stadium
            WHERE d.id = :scheduleId
            """)
    Optional<PerformanceDetail> findWithPerformanceById(@Param("scheduleId") Long scheduleId);

    boolean existsByPerformanceIdAndPerformanceNum(Long performanceId, int performanceNum);

    /** 회차 등록(API-265) 시 다음 회차 번호를 정하는 데 쓴다 */
    @Query("SELECT COALESCE(MAX(d.performanceNum), 0) FROM PerformanceDetail d WHERE d.performance.id = :performanceId")
    int findMaxPerformanceNum(@Param("performanceId") Long performanceId);
}
