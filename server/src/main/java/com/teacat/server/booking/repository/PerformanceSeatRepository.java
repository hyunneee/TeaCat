package com.teacat.server.booking.repository;

import com.teacat.server.booking.entity.PerformanceSeat;
import com.teacat.server.booking.entity.PerformanceSeatId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PerformanceSeatRepository extends JpaRepository<PerformanceSeat, PerformanceSeatId> {

    @Query(value = """
            SELECT COUNT(*) FROM performance_seats ps
            JOIN performance_details pd ON pd.id = ps.performance_detail_id
            WHERE pd.performance_general_id = :performanceId
              AND ps.seat_id IN (:seatIds)
              AND ps.status IN ('HELD', 'SOLD')
            """, nativeQuery = true)
    long countHeldOrSold(Long performanceId, List<Long> seatIds);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE performance_seats ps
               SET status = 'AVAILABLE', held_by = NULL, held_until = NULL, updated_at = now()
              FROM performance_details pd
             WHERE pd.id = ps.performance_detail_id
               AND pd.performance_general_id = :performanceId
               AND ps.status = 'BLOCKED'
            """, nativeQuery = true)
    int unblockAll(Long performanceId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE performance_seats ps
               SET status = 'BLOCKED', held_by = NULL, held_until = NULL, updated_at = now()
              FROM performance_details pd
             WHERE pd.id = ps.performance_detail_id
               AND pd.performance_general_id = :performanceId
               AND ps.seat_id IN (:seatIds)
               AND ps.status = 'AVAILABLE'
            """, nativeQuery = true)
    int blockAvailable(Long performanceId, List<Long> seatIds);

    /**
     * 이 회차에 좌석 행이 이미 만들어져 있는지 (공연 도메인의 회차 좌석 생성 API-269 가 중복 생성을 막는 데 쓴다).
     * performance_seats 엔티티·저장소는 이 하나만 둔다 — 같은 테이블을 두 엔티티로 매핑하면 빈·엔티티 이름이 충돌한다.
     */
    boolean existsByIdPerformanceDetailId(Long performanceDetailId);

    /**
     * 회차의 좌석 상태 전체 (좌석맵 조회).
     *
     * <p>좌표·열·번호는 여기 없다. 그건 공연장 좌석(seats)의 것이고, 이 테이블은
     * "이 회차에서 그 좌석이 지금 어떤 상태인가" 만 안다. 서비스가 둘을 합친다.
     *
     * <p>🔴 만료 판정을 <b>SQL 안에서</b> 한다. 자바에서 {@code LocalDateTime.now()} 로
     * 비교하면 안 된다 — 위 {@link #hold} 가 {@code held_until < now()} 로 DB 시계를 쓰는데,
     * 앱 컨테이너는 {@code TZ=Asia/Seoul} 이고 DB 컨테이너는 UTC 라 두 시계가 9시간 어긋난다.
     * 시계가 다르면 <b>좌석맵은 "고를 수 있다" 고 그리는데 선점 API 는 거절하는</b>
     * 구간이 생긴다 (사용자에게는 "눌러도 안 되는 좌석" 으로 보인다).
     * 같은 시계로 판단해야 화면과 동작이 어긋나지 않는다.
     */
    @Query(value = """
            SELECT ps.seat_id AS seatId,
                   CASE WHEN ps.status = 'HELD' AND ps.held_until < now()
                        THEN 'AVAILABLE'
                        ELSE ps.status::text
                   END AS status
              FROM performance_seats ps
             WHERE ps.performance_detail_id = :performanceDetailId
            """, nativeQuery = true)
    List<SeatStatusView> findEffectiveStatuses(@Param("performanceDetailId") Long performanceDetailId);

    /**
     * 회차별 좌석 수 — 준비된 좌석과 그중 지금 고를 수 있는 좌석.
     *
     * <p><b>매진을 알아내기 위한 쿼리다.</b> {@code performance_details.status} 의 SOLD_OUT 은
     * 운영자가 손으로 바꾸는 값이라, 좌석이 실제로 다 팔려도 자동으로 바뀌지 않는다. 그래서
     * 공연 목록과 회차 목록이 매진된 회차를 계속 "예매 가능" 으로 보여주고 있었다.
     *
     * <p>🔴 만료 판정을 SQL 안에서 한다 — {@link #findEffectiveStatuses} 와 같은 이유다.
     * 자바 시계로 비교하면 좌석맵·선점 API 와 답이 달라진다.
     *
     * <p>좌석 행이 아예 없는 회차는 결과에 <b>나오지 않는다</b>(GROUP BY). 그건 매진이 아니라
     * 좌석을 아직 만들지 않은 것이므로, 부르는 쪽이 "없으면 매진 아님" 으로 다뤄야 한다.
     */
    @Query(value = """
            SELECT ps.performance_detail_id AS "scheduleId",
                   COUNT(*)                 AS "totalCount",
                   COUNT(*) FILTER (
                       WHERE ps.status = 'AVAILABLE'
                          OR (ps.status = 'HELD' AND ps.held_until < now())
                   )                        AS "availableCount"
              FROM performance_seats ps
             WHERE ps.performance_detail_id IN (:scheduleIds)
             GROUP BY ps.performance_detail_id
            """, nativeQuery = true)
    List<SeatCountView> findSeatCounts(@Param("scheduleIds") Collection<Long> scheduleIds);

    /** {@link #findSeatCounts} 결과 한 줄 */
    interface SeatCountView {
        Long getScheduleId();

        /** 이 회차에 만들어진 좌석 수 */
        long getTotalCount();

        /** 그중 지금 고를 수 있는 좌석 수 (만료된 HELD 포함) */
        long getAvailableCount();
    }

    /** {@link #findEffectiveStatuses} 결과 한 줄 */
    interface SeatStatusView {
        Long getSeatId();

        /** {@code seat_booking_status} 값의 문자열. 만료된 HELD 는 AVAILABLE 로 바뀐 뒤 */
        String getStatus();
    }

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
                   pg.ticketing_start_at  AS "ticketingStartAt",
                   pd.performance_date    AS "performanceDate"
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

        /** performance_details.performance_date */
        LocalDateTime getPerformanceDate();
    }

    /**
     * 결제 확정 — 선점을 판매로 굳힌다.
     *
     * <p>조회로 확인한 뒤 UPDATE 하면 그 사이에 선점이 만료되어 남이 가져갈 수 있다. 조건을
     * WHERE 에 넣어 <b>내 유효한 선점만</b> 원자적으로 SOLD 로 바꾼다.
     *
     * @return 1 이면 확보, 0 이면 그 사이 선점을 잃었다 (결제를 되돌려야 한다)
     */
    // clearAutomatically 를 쓰지 않는다. 컨텍스트를 비우면 부르는 쪽이 들고 있던 주문·회원이
    // detach 되어, 이어서 하는 발권과 상태 변경이 조용히 반영되지 않는다.
    // 여기서는 좌석 엔티티를 이후에 읽지 않으므로 비울 이유도 없다.
    @Modifying(flushAutomatically = true)
    @Query(value = """
            UPDATE performance_seats
               SET status = 'SOLD',
                   held_until = NULL,
                   updated_at = now()
             WHERE performance_detail_id = :performanceDetailId
               AND seat_id = :seatId
               AND status = 'HELD'
               AND held_by = :userId
               AND held_until >= now()
            """, nativeQuery = true)
    int sell(@Param("performanceDetailId") Long performanceDetailId,
            @Param("seatId") Long seatId,
            @Param("userId") Long userId);

    /**
     * 예매 취소 — 팔린 좌석을 다시 풀어 준다.
     *
     * <p>{@code releaseHold} 와 다르다. 저쪽은 선점(HELD)을 푸는 것이고, 이것은 확정된 판매를
     * 되돌린다. SOLD 는 취소로만 풀리므로 소유자 검사가 필요 없다 — 취소 권한은 주문에서 이미 봤다.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = """
            UPDATE performance_seats
               SET status = 'AVAILABLE',
                   held_by = NULL,
                   held_until = NULL,
                   updated_at = now()
             WHERE performance_detail_id = :performanceDetailId
               AND seat_id = :seatId
               AND status = 'SOLD'
            """, nativeQuery = true)
    int release(@Param("performanceDetailId") Long performanceDetailId,
            @Param("seatId") Long seatId);
}
