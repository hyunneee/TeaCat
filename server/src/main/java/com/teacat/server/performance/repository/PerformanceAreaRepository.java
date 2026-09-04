package com.teacat.server.performance.repository;

import com.teacat.server.performance.entity.PerformanceArea;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PerformanceAreaRepository
        extends JpaRepository<PerformanceArea, PerformanceArea.PerformanceAreaId> {

    /** 공연에 설정된 구역 전체 (API-268 조회·재저장, API-269 판매 구역 판단) */
    @Query("""
            SELECT pa FROM PerformanceArea pa
            JOIN FETCH pa.area
            WHERE pa.id.performanceGeneralId = :performanceId
            """)
    List<PerformanceArea> findAllByPerformanceId(@Param("performanceId") Long performanceId);

    /**
     * 이번 요청에 없는 구역을 지운다 (API-268 은 PUT 이라 보낸 목록이 전체다).
     *
     * 복합키라 파생 메서드로는 표현이 지저분해져 JPQL 로 둔다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            DELETE FROM PerformanceArea pa
            WHERE pa.id.performanceGeneralId = :performanceId
              AND pa.id.areaId NOT IN :keepAreaIds
            """)
    void deleteByPerformanceIdAndAreaIdNotIn(@Param("performanceId") Long performanceId,
                                             @Param("keepAreaIds") List<Long> keepAreaIds);
}
