package com.teacat.server.resale.repository;

import com.teacat.server.resale.entity.ResaleEntryStatus;
import com.teacat.server.resale.entity.SeatDraw;
import com.teacat.server.resale.entity.SeatDrawStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * 🔴 JPQL 에 enum 을 <b>리터럴로 쓰지 않는다.</b> {@code d.status = com.…SeatDrawStatus.REVEALED} 처럼 쓰면
 * Hibernate 가 {@code 'REVEALED'::SeatDrawStatus} 로 렌더링하는데, Postgres 타입 이름은
 * {@code seat_draw_status} 라 "type does not exist" 로 죽는다 (2026-09-21 dev 장애).
 * 파라미터로 넘기면 컬럼의 {@code @JdbcTypeCode(NAMED_ENUM)} 을 타고 올바른 타입으로 바인딩된다.
 */
public interface SeatDrawRepository extends JpaRepository<SeatDraw, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from SeatDraw d where d.id = :id")
    Optional<SeatDraw> findByIdForUpdate(@Param("id") Long id);

    /** 스위퍼가 상태별로 훑는다. 오래된 것부터 */
    List<SeatDraw> findByStatusOrderByIdAsc(SeatDrawStatus status, Limit limit);

    Optional<SeatDraw> findByDrawKey(String drawKey);

    /**
     * 이 좌석에 지금까지 열린 추첨 회차 중 가장 큰 번호. 한 번도 없으면 0.
     *
     * <p>🔴 <b>새 추첨은 이 값 + 1 이다.</b> 언제나 1 로 시작하면, 한 번 추첨이 돌았던 좌석은
     * 두 번째 취소에서 {@code uq_seat_draws_draw_key} 에 걸려 <b>취소 자체가 500 으로 터진다</b>
     * (당첨자가 산 좌석을 그 사람이 다시 취소하는, 아주 평범한 흐름이다 — 2026-09-23 재현).
     * 상태와 무관하게 센다. 끝난 추첨도 키는 영구히 남기 때문이다.
     */
    @Query("""
            select coalesce(max(d.drawNo), 0) from SeatDraw d
             where d.performanceDetailId = :performanceDetailId and d.seatId = :seatId
            """)
    int maxDrawNo(@Param("performanceDetailId") Long performanceDetailId, @Param("seatId") Long seatId);

    @Query("""
            select d from SeatDraw d
             where d.performanceDetailId = :performanceDetailId and d.seatId = :seatId
               and d.status in :statuses
            """)
    Optional<SeatDraw> findBySeatAndStatusIn(@Param("performanceDetailId") Long performanceDetailId,
            @Param("seatId") Long seatId, @Param("statuses") List<SeatDrawStatus> statuses);

    /**
     * 이 좌석에서 <b>지금 돌고 있는</b> 추첨. 좌석마다 하나뿐이다
     * ({@code uq_seat_draws_active_seat} 가 강제한다).
     */
    default Optional<SeatDraw> findActiveBySeat(Long performanceDetailId, Long seatId) {
        return findBySeatAndStatusIn(performanceDetailId, seatId,
                List.of(SeatDrawStatus.PENDING, SeatDrawStatus.OPEN, SeatDrawStatus.REVEALED));
    }

    /**
     * 난수는 있는데 구매권을 쥔 사람이 <b>없는</b> 추첨 — 1순위에게 좌석을 넘겨야 한다.
     *
     * <p>구매권을 쥔 당첨자(WON)가 있는 추첨은 최대 12시간 REVEALED 로 머무른다. 그것까지 훑으면
     * 인기 공연에서 그 행들이 배치 한도를 다 채워 <b>정작 넘겨야 할 추첨이 뒤로 밀린다.</b>
     * 그래서 넘길 일이 있는 것만 고른다.
     */
    default List<SeatDraw> findRevealedNeedingAdvance(Limit limit) {
        return findByStatusWithoutHolderInStatus(SeatDrawStatus.REVEALED, ResaleEntryStatus.WON, limit);
    }

    @Query("""
            select d from SeatDraw d
             where d.status = :drawStatus
               and (d.currentEntryId is null
                    or not exists (
                        select e from ResaleEntry e
                         where e.id = d.currentEntryId
                           and e.status = :holderStatus))
             order by d.id
            """)
    List<SeatDraw> findByStatusWithoutHolderInStatus(@Param("drawStatus") SeatDrawStatus drawStatus,
                                                     @Param("holderStatus") ResaleEntryStatus holderStatus,
                                                     Limit limit);
}
