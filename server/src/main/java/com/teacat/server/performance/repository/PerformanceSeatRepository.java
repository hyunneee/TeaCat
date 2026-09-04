package com.teacat.server.performance.repository;

import com.teacat.server.performance.entity.PerformanceSeat;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PerformanceSeatRepository
        extends JpaRepository<PerformanceSeat, PerformanceSeat.PerformanceSeatId> {

    /** 이미 좌석을 만든 회차인지 (API-269 중복 생성 방지) */
    boolean existsByIdPerformanceDetailId(Long performanceDetailId);

    long countByIdPerformanceDetailId(Long performanceDetailId);
}
