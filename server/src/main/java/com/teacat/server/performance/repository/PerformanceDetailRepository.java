package com.teacat.server.performance.repository;

import com.teacat.server.performance.entity.PerformanceDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PerformanceDetailRepository extends JpaRepository<PerformanceDetail, Long> {

    /** 공연 회차 목록 (API-202, API-204) */
    List<PerformanceDetail> findByPerformanceIdOrderByPerformanceNumAsc(Long performanceId);

    /**
     * 여러 공연의 회차를 한 번에 (API-201 목록의 대표 예매 상태 계산용).
     *
     * <p>공연마다 따로 조회하면 목록 한 장에 N 번 쿼리가 나간다.
     */
    List<PerformanceDetail> findByPerformanceIdIn(Collection<Long> performanceIds);

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
            WHERE d.id = :scheduleId AND p.hiddenAt IS NULL
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

    /**
     * 회차 번호 재부여 1단계 — 전부 음수로 비켜둔다 (API-265, 267).
     *
     * (performance_general_id, performance_num) 에 UNIQUE 가 있고 PostgreSQL 은 한 UPDATE 안에서도
     * 행마다 즉시 검사하므로, 1↔2 처럼 번호가 자리를 바꾸는 갱신은 한 번에 하면 중간에 충돌한다.
     * 음수는 쓰이지 않는 값이라 겹칠 일이 없다. 2단계(renumberByDate)와 같은 트랜잭션에서 실행한다.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            UPDATE performance_details
            SET performance_num = -performance_num
            WHERE performance_general_id = :performanceId
            """, nativeQuery = true)
    void negatePerformanceNums(@Param("performanceId") Long performanceId);

    /**
     * 회차 번호 재부여 2단계 — 공연 일시가 빠른 순으로 1 부터 다시 매긴다.
     * 일시가 같으면 먼저 만들어진 회차(id 오름차순)가 앞이다.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            UPDATE performance_details d
            SET performance_num = r.rn
            FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY performance_date, id) AS rn
                  FROM performance_details
                  WHERE performance_general_id = :performanceId) r
            WHERE d.id = r.id
            """, nativeQuery = true)
    void renumberByDate(@Param("performanceId") Long performanceId);

    /** 재부여 뒤의 번호. 영속성 컨텍스트가 비워진 뒤라 DB 에서 다시 읽는다 */
    @Query("SELECT d.performanceNum FROM PerformanceDetail d WHERE d.id = :scheduleId")
    int findPerformanceNumById(@Param("scheduleId") Long scheduleId);

    /** 회차 등록(API-265) 시 다음 회차 번호를 정하는 데 쓴다 */
    @Query("SELECT COALESCE(MAX(d.performanceNum), 0) FROM PerformanceDetail d WHERE d.performance.id = :performanceId")
    int findMaxPerformanceNum(@Param("performanceId") Long performanceId);
}
