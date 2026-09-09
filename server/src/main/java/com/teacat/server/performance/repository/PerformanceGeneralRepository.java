package com.teacat.server.performance.repository;

import com.teacat.server.performance.entity.PerformanceGeneral;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PerformanceGeneralRepository extends JpaRepository<PerformanceGeneral, Long> {

    @Query("SELECT p FROM PerformanceGeneral p JOIN FETCH p.stadium JOIN FETCH p.stadiumLayout WHERE p.id = :performanceId")
    Optional<PerformanceGeneral> findByIdWithStadiumAndLayout(Long performanceId);

    /**
     * 공연 목록 조회 (API-201).
     *
     * 커서는 마지막으로 받은 공연 ID 다. id 내림차순이라 그보다 작은 id 를 이어서 준다.
     * cursor 가 null 이면 첫 페이지다. 비공개(hidden_at) 공연은 여기서 직접 제외한다.
     *
     * titlePattern 은 LIKE 패턴을 그대로 받는다. 검색어가 없으면 '%' 를 넘긴다.
     * 여기서 null 을 넘기면 PostgreSQL 이 파라미터 타입을 bytea 로 추론해
     * lower(bytea) 함수를 찾다 실패하므로, null 분기를 두지 않는다.
     */
    @Query("""
            SELECT p FROM PerformanceGeneral p
            JOIN FETCH p.stadium
            WHERE p.hiddenAt IS NULL
              AND p.visibleFrom <= :today
              AND (:cursor IS NULL OR p.id < :cursor)
              AND LOWER(p.title) LIKE LOWER(:titlePattern) ESCAPE '\\'
            ORDER BY p.id DESC
            """)
    List<PerformanceGeneral> findPage(@Param("today") LocalDate today,
                                      @Param("cursor") Long cursor,
                                      @Param("titlePattern") String titlePattern,
                                      Pageable pageable);

    /**
     * 오픈 예정 공연 목록 (API-207).
     *
     * 이미 노출은 시작됐지만 티켓팅은 아직 열리지 않은 공연이다.
     * 메인의 "티켓 오픈 예정" 섹션이라 임박한 순서로 준다.
     */
    @Query("""
            SELECT p FROM PerformanceGeneral p
            JOIN FETCH p.stadium
            WHERE p.hiddenAt IS NULL
              AND p.visibleFrom <= :today
              AND p.ticketingStartAt > :now
            ORDER BY p.ticketingStartAt ASC
            """)
    List<PerformanceGeneral> findUpcomingOpen(@Param("today") LocalDate today,
                                              @Param("now") LocalDateTime now,
                                              Pageable pageable);

    /** 공개 상태인 공연만 (클라이언트 조회 API-202) */
    @Query("""
            SELECT p FROM PerformanceGeneral p
            JOIN FETCH p.stadium
            WHERE p.id = :concertId AND p.hiddenAt IS NULL
            """)
    Optional<PerformanceGeneral> findVisibleById(@Param("concertId") Long concertId);

    /** 공개 상태인 공연이 존재하는지 (API-204, API-205) */
    boolean existsByIdAndHiddenAtIsNull(Long concertId);

    /**
     * 이 관리자가 등록한 공연 전부 — **비공개 포함**.
     *
     * 관리자가 비공개로 돌린 공연을 다시 찾아 공개로 되돌리려면 어딘가에는 보여야 한다.
     * 클라이언트 목록(findPage)은 비공개를 숨기므로 여기서 따로 준다. 최근 등록순.
     */
    @Query("""
            SELECT p FROM PerformanceGeneral p
            JOIN FETCH p.stadium
            WHERE p.createdById = :userId
            ORDER BY p.id DESC
            """)
    List<PerformanceGeneral> findAllByCreatedById(@Param("userId") Long userId);

    /**
     * 등록자를 가리지 않은 공연 전부 — **비공개 포함**. 전체 관리자(ADMIN)의 관리 목록이다.
     *
     * ADMIN 은 남이 등록한 공연도 수정·삭제할 수 있으므로 그 공연들이 목록에 보여야 한다.
     * 특히 남이 비공개로 돌린 공연은 클라이언트 목록에 없어서, 여기 말고는 찾아갈 길이 없다.
     */
    @Query("""
            SELECT p FROM PerformanceGeneral p
            JOIN FETCH p.stadium
            ORDER BY p.id DESC
            """)
    List<PerformanceGeneral> findAllForAdmin();

    /**
     * 이 공연에 예매 이력이 있는지 (API-263).
     *
     * 티켓 도메인 엔티티가 아직 없어서 네이티브 쿼리로 확인한다.
     * 취소된 티켓도 이력으로 본다. 지워버리면 취소 내역을 추적할 수 없기 때문이다.
     */
    @Query(value = """
            SELECT EXISTS (SELECT 1
                           FROM tickets t
                                    JOIN performance_details d ON d.id = t.performance_detail_id
                           WHERE d.performance_general_id = :performanceId)
            """, nativeQuery = true)
    boolean existsTicketByPerformanceId(@Param("performanceId") Long performanceId);

    /**
     * 예매 이력이 없는 공연의 물리 삭제 (API-263).
     *
     * 자식 행이 FK 로 묶여 있어 아래에서 위로 지운다.
     * JPA 로 하면 회차·좌석 엔티티가 모두 필요해서 네이티브로 처리한다.
     */
    @Modifying
    @Query(value = """
            DELETE FROM performance_seats
            WHERE performance_detail_id IN
                  (SELECT id FROM performance_details WHERE performance_general_id = :performanceId)
            """, nativeQuery = true)
    void deleteSeatsByPerformanceId(@Param("performanceId") Long performanceId);

    @Modifying
    @Query(value = "DELETE FROM performance_details WHERE performance_general_id = :performanceId",
            nativeQuery = true)
    void deleteDetailsByPerformanceId(@Param("performanceId") Long performanceId);

    @Modifying
    @Query(value = "DELETE FROM performance_areas WHERE performance_general_id = :performanceId",
            nativeQuery = true)
    void deleteAreasByPerformanceId(@Param("performanceId") Long performanceId);
}
