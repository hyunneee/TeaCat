package com.teacat.server.booking.repository;

import com.teacat.server.booking.entity.PerformanceSeat;
import com.teacat.server.booking.entity.PerformanceSeatId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PerformanceSeatRepository extends JpaRepository<PerformanceSeat, PerformanceSeatId> {

    /**
     * 같은 회차에서 이 유저가 쥐고 있던 <b>만료된</b> 선점을 해제한다. 새 좌석을 선점하기 직전에 호출한다.
     *
     * <p>필요한 이유: {@code uq_performance_seats_held_by} 는 물리 {@code status} 만 보므로,
     * 만료된 행이 {@code HELD} 로 남아 있으면 그 유저는 다른 좌석을 잡을 때 1인 1매 위반으로 막힌다.
     * 실제로는 아무 좌석도 쥐고 있지 않은데 잠기는 것이다.
     *
     * <p>인덱스 predicate 는 {@code IMMUTABLE} 함수만 쓸 수 있고 {@code now()} 는 {@code STABLE} 이라
     * 인덱스 자체에 만료 조건을 넣을 수 없다. 그래서 이 선제 해제가 대안 없이 필요하다.
     *
     * @return 해제된 행 수. 유니크 인덱스 덕분에 최대 1 이고, 0 이어도 정상 흐름이다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE performance_seats
               SET status = 'AVAILABLE',
                   held_by = NULL,
                   held_until = NULL,
                   updated_at = now()
             WHERE performance_detail_id = :performanceDetailId
               AND held_by = :userId
               AND status = 'HELD'
               AND held_until < now()
            """, nativeQuery = true)
    int releaseExpiredHold(@Param("performanceDetailId") Long performanceDetailId,
                           @Param("userId") Long userId);

    /**
     * 좌석을 선점한다. 조건부 UPDATE 한 방으로 처리하는 이유:
     *
     * <p>Postgres READ COMMITTED 에서 같은 행을 노리는 두 UPDATE 는, 뒤에 온 쪽이 행 락을 얻은 뒤
     * <b>갱신된 행 버전으로 WHERE 를 재평가</b>한다(EvalPlanQual). 따라서 WHERE 의 상태 조건이
     * 원자적인 test-and-set 이 되고, SELECT 후 UPDATE 에서 생기는 lost update 가 없다.
     *
     * <p>만료된 {@code HELD} 도 조건에 포함해 <b>그 자리에서 흡수</b>한다. 덕분에 만료 좌석을 되돌리는
     * 배치가 없어도 좌석이 유실되지 않는다. (정리 배치는 표시 위생 목적의 선택 사항이 된다)
     *
     * <p>{@code updated_at} 을 SQL 에서 직접 넣는 이유는 엔티티의 {@code @UpdateTimestamp} 가
     * 벌크/네이티브 UPDATE 에는 적용되지 않기 때문이다.
     *
     * @return 갱신된 행 수. 0 이면 선점 실패이며 사유는 현재 좌석 상태를 다시 읽어 판별한다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE performance_seats
               SET status = 'HELD',
                   held_by = :userId,
                   held_until = :heldUntil,
                   updated_at = now()
             WHERE performance_detail_id = :performanceDetailId
               AND seat_id = :seatId
               AND (status = 'AVAILABLE'
                    OR (status = 'HELD' AND held_until < now()))
            """, nativeQuery = true)
    int hold(@Param("performanceDetailId") Long performanceDetailId,
             @Param("seatId") Long seatId,
             @Param("userId") Long userId,
             @Param("heldUntil") LocalDateTime heldUntil);

    /**
     * 내가 선점한 좌석을 해제한다.
     *
     * <p>{@code held_by = :userId} 를 WHERE 에 두는 것이 <b>권한 검사 그 자체</b>다. 조회로 소유자를
     * 확인한 뒤 UPDATE 하면 그 사이에 소유자가 바뀔 수 있지만, 이 조건은 행 락을 얻은 뒤 재평가되므로
     * 남의 선점을 해제하는 일이 원자적으로 불가능하다. 실패 사유는 갱신된 행 수가 0 일 때만 따로 읽는다.
     *
     * <p>{@code held_until >= now()} 까지 요구하는 이유: 이미 만료된 선점은 해제할 대상이 아니라
     * "다시 고르라"고 알려야 하는 상태다({@code ERR_BOOKING_009}).
     *
     * @return 갱신된 행 수. 1 이면 해제 성공, 0 이면 실패이며 사유는 좌석을 다시 읽어 판별한다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE performance_seats
               SET status = 'AVAILABLE',
                   held_by = NULL,
                   held_until = NULL,
                   updated_at = now()
             WHERE performance_detail_id = :performanceDetailId
               AND seat_id = :seatId
               AND status = 'HELD'
               AND held_by = :userId
               AND held_until >= now()
            """, nativeQuery = true)
    int releaseHold(@Param("performanceDetailId") Long performanceDetailId,
                    @Param("seatId") Long seatId,
                    @Param("userId") Long userId);

    /**
     * 이 유저의 만료된 선점을 <b>회차 구분 없이 전부</b> 해제한다. 내 선점 목록을 조회하기 직전에 호출한다.
     *
     * <p>{@link #releaseExpiredHold} 와 조건이 겹치지만 범위가 다르다. 선점 경로는 해당 회차만 건드려야
     * {@code uq_performance_seats_held_by (performance_detail_id, held_by)} 인덱스를 두 컬럼으로
     * 온전히 타는데, 이 메서드는 회차를 모르므로 그럴 수 없다. 호출 빈도가 낮은 조회 경로에만 쓴다.
     *
     * @return 해제된 행 수. 0 이어도 정상 흐름이다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE performance_seats
               SET status = 'AVAILABLE',
                   held_by = NULL,
                   held_until = NULL,
                   updated_at = now()
             WHERE held_by = :userId
               AND status = 'HELD'
               AND held_until < now()
            """, nativeQuery = true)
    int releaseAllExpiredHolds(@Param("userId") Long userId);

    /**
     * 이 유저가 선점 중인 좌석을 결제 화면에 필요한 정보까지 붙여 읽는다.
     * 만료 정리({@link #releaseAllExpiredHolds}) 이후에 호출하는 것을 전제로 한다.
     *
     * <p>{@code remainingSeconds} 는 DB 시계로 계산한다. 만료 판정도 DB {@code now()} 로 이뤄지므로
     * 같은 기준을 쓰는 것이 클라이언트에 가장 정확하다. 만료 정리와 이 조회 사이의 좁은 창을 대비해
     * 음수는 0 으로 깎는다.
     *
     * <p>등급/가격은 {@code performance_areas} 에 행이 없을 수 있어 LEFT JOIN 이다.
     */
    @Query(value = """
            SELECT ps.performance_detail_id AS "performanceDetailId",
                   ps.seat_id               AS "seatId",
                   ps.held_until            AS "heldUntil",
                   GREATEST(EXTRACT(EPOCH FROM (ps.held_until - now()))::bigint, 0)
                                            AS "remainingSeconds",
                   pg.title                 AS "performanceTitle",
                   pg.poster_img            AS "posterImg",
                   pd.performance_num       AS "performanceNum",
                   pd.performance_date      AS "performanceDate",
                   st.name                  AS "stadiumName",
                   a.area_code              AS "areaCode",
                   s.row_label              AS "rowLabel",
                   s.seat_number            AS "seatNumber",
                   pa.grade                 AS "grade",
                   pa.price                 AS "price"
              FROM performance_seats ps
              JOIN performance_details pd ON pd.id = ps.performance_detail_id
              JOIN performance_general pg ON pg.id = pd.performance_general_id
              JOIN seats s                ON s.id = ps.seat_id
              JOIN areas a                ON a.id = s.area_id
              JOIN stadiums st            ON st.id = pg.stadium_id
              LEFT JOIN performance_areas pa
                     ON pa.performance_general_id = pg.id AND pa.area_id = a.id
             WHERE ps.held_by = :userId
               AND ps.status = 'HELD'
             ORDER BY ps.held_until
            """, nativeQuery = true)
    List<MyHold> findMyHolds(@Param("userId") Long userId);

    /**
     * 회차의 예매 가능 여부 판단에 필요한 값만 읽는다. 결과가 비어 있으면 회차 자체가 없다는 뜻이다.
     *
     * <p>TODO 공연 도메인이 생기면 이 조회는 그쪽 repository 로 옮긴다.
     * (지금은 performance 패키지가 없어 예매 도메인에서 직접 읽는다)
     */
    @Query(value = """
            SELECT pd.status::text        AS "ticketingStatus",
                   pg.ticketing_start_at  AS "ticketingStartAt"
              FROM performance_details pd
              JOIN performance_general pg ON pg.id = pd.performance_general_id
             WHERE pd.id = :performanceDetailId
            """, nativeQuery = true)
    Optional<TicketingWindow> findTicketingWindow(
            @Param("performanceDetailId") Long performanceDetailId);

    /** {@link #findMyHolds} 결과 프로젝션. */
    interface MyHold {

        Long getPerformanceDetailId();

        Long getSeatId();

        LocalDateTime getHeldUntil();

        long getRemainingSeconds();

        String getPerformanceTitle();

        String getPosterImg();

        Integer getPerformanceNum();

        LocalDateTime getPerformanceDate();

        String getStadiumName();

        String getAreaCode();

        String getRowLabel();

        Integer getSeatNumber();

        /** performance_areas.grade — 등급이 설정되지 않았으면 null */
        String getGrade();

        /** performance_areas.price — 가격이 설정되지 않았으면 null */
        Integer getPrice();
    }

    /** {@link #findTicketingWindow} 결과 프로젝션. */
    interface TicketingWindow {

        /** performance_details.status (ticketing_status: SCHEDULED / OPEN / SOLD_OUT / CLOSED) */
        String getTicketingStatus();

        /** performance_general.ticketing_start_at */
        LocalDateTime getTicketingStartAt();
    }
}
