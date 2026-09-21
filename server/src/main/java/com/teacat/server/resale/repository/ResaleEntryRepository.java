package com.teacat.server.resale.repository;

import com.teacat.server.resale.entity.ResaleEntry;
import com.teacat.server.resale.entity.ResaleEntryStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ResaleEntryRepository extends JpaRepository<ResaleEntry, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from ResaleEntry e where e.id = :id")
    Optional<ResaleEntry> findByIdForUpdate(@Param("id") Long id);

    long countByPerformanceDetailIdAndAreaIdAndStatus(Long performanceDetailId, Long areaId,
                                                      ResaleEntryStatus status);

    /** 추첨 참가자 스냅샷. <b>오름차순</b>이어야 체인이 받는다 */
    List<ResaleEntry> findByPerformanceDetailIdAndAreaIdAndStatusOrderByIdAsc(
            Long performanceDetailId, Long areaId, ResaleEntryStatus status);

    boolean existsByUserIdAndPerformanceDetailIdAndAreaIdAndStatus(
            Long userId, Long performanceDetailId, Long areaId, ResaleEntryStatus status);

    List<ResaleEntry> findByUserIdAndStatusInOrderByCreatedAtDesc(
            Long userId, Collection<ResaleEntryStatus> statuses);

    Optional<ResaleEntry> findByIdAndUserId(Long id, Long userId);

    /** 당첨자가 그 좌석을 결제했는지 대조할 때 */
    Optional<ResaleEntry> findFirstByUserIdAndPerformanceDetailIdAndSeatIdAndStatus(
            Long userId, Long performanceDetailId, Long seatId, ResaleEntryStatus status);

    /** 기한이 지난 당첨 */
    @Query("""
            select e.id from ResaleEntry e
             where e.status = com.teacat.server.resale.entity.ResaleEntryStatus.WON
               and e.deadlineAt < :now
             order by e.deadlineAt
            """)
    List<Long> findExpiredWonIds(@Param("now") LocalDateTime now, Limit limit);

    /**
     * 취소 마감이 지난 회차의 대기를 전부 LOST 로 접는다. 그 회차에서는 더 이상 취소표가 나올 수 없다.
     *
     * @param cutoff 지금 + 취소 마감 리드. {@code performance_date < cutoff} 면 마감이 지났다
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update ResaleEntry e
               set e.status = com.teacat.server.resale.entity.ResaleEntryStatus.LOST,
                   e.updatedAt = :now
             where e.status = com.teacat.server.resale.entity.ResaleEntryStatus.WAITING
               and e.performanceDetailId in (
                   select d.id from PerformanceDetail d where d.performanceDate < :cutoff)
            """)
    int markLostPastDeadline(@Param("cutoff") LocalDateTime cutoff, @Param("now") LocalDateTime now);

    /** 구역별 대기 인원 (한 회차) */
    @Query("""
            select e.areaId as areaId, count(e) as waitingCount
              from ResaleEntry e
             where e.performanceDetailId = :performanceDetailId
               and e.status = com.teacat.server.resale.entity.ResaleEntryStatus.WAITING
             group by e.areaId
            """)
    List<AreaWaitingCount> countWaitingByArea(@Param("performanceDetailId") Long performanceDetailId);

    interface AreaWaitingCount {
        Long getAreaId();

        long getWaitingCount();
    }
}
