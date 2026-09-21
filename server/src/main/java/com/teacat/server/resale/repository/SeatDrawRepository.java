package com.teacat.server.resale.repository;

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

public interface SeatDrawRepository extends JpaRepository<SeatDraw, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from SeatDraw d where d.id = :id")
    Optional<SeatDraw> findByIdForUpdate(@Param("id") Long id);

    /** 스위퍼가 상태별로 훑는다. 오래된 것부터 */
    List<SeatDraw> findByStatusOrderByIdAsc(SeatDrawStatus status, Limit limit);

    /**
     * 난수는 있는데 구매권을 쥔 사람이 <b>없는</b> 추첨 — 다음 순위로 넘겨야 한다.
     *
     * <p>구매권을 쥔 당첨자(WON)가 있는 추첨은 최대 12시간 REVEALED 로 머무른다. 그것까지 훑으면
     * 인기 공연에서 그 행들이 배치 한도를 다 채워 <b>정작 넘겨야 할 추첨이 뒤로 밀린다.</b>
     * 그래서 넘길 일이 있는 것만 고른다.
     */
    @Query("""
            select d from SeatDraw d
             where d.status = com.teacat.server.resale.entity.SeatDrawStatus.REVEALED
               and (d.currentEntryId is null
                    or not exists (
                        select e from ResaleEntry e
                         where e.id = d.currentEntryId
                           and e.status = com.teacat.server.resale.entity.ResaleEntryStatus.WON))
             order by d.id
            """)
    List<SeatDraw> findRevealedNeedingAdvance(Limit limit);

    Optional<SeatDraw> findByDrawKey(String drawKey);
}
