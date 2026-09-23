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

    /**
     * 한 회차에 아직 없는 판매 좌석을 추가한다.
     *
     * <p>스탠딩 구역에도 좌표 없는 가상 좌석이 저장된다. 공연별 최대 인원(max_cnt)까지만
     * 회차 좌석으로 옮기고, 지정석은 등록된 좌석을 모두 옮긴다. PK 충돌은 무시하므로
     * 관리자 재시도와 자동 스케줄러가 동시에 실행돼도 중복 생성되지 않는다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            WITH inventory AS (
                SELECT pd.id AS performance_detail_id,
                       s.id AS seat_id,
                       pa.sale_type,
                       pa.max_cnt,
                       ROW_NUMBER() OVER (
                           PARTITION BY pd.id, pa.area_id
                           ORDER BY s.seat_number, s.id
                       ) AS inventory_number
                  FROM performance_details pd
                  JOIN performance_areas pa
                    ON pa.performance_general_id = pd.performance_general_id
                  JOIN seats s ON s.area_id = pa.area_id
                 WHERE pd.id = :scheduleId
            )
            INSERT INTO performance_seats
                (performance_detail_id, seat_id, status, updated_at)
            SELECT performance_detail_id, seat_id, 'AVAILABLE'::seat_booking_status, now()
              FROM inventory
             WHERE sale_type = 'SEATED'::area_type
                OR inventory_number <= max_cnt
            ON CONFLICT (performance_detail_id, seat_id) DO NOTHING
            """, nativeQuery = true)
    int insertMissingForSchedule(@Param("scheduleId") Long scheduleId);

    /**
     * 예매 오픈 시각이 지난, 아직 공연 전인 모든 회차의 누락 좌석을 채운다.
     * DB now()를 사용해 앱/DB 컨테이너의 타임존 차이로 오픈 시점이 어긋나지 않게 한다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            WITH inventory AS (
                SELECT pd.id AS performance_detail_id,
                       s.id AS seat_id,
                       pa.sale_type,
                       pa.max_cnt,
                       ROW_NUMBER() OVER (
                           PARTITION BY pd.id, pa.area_id
                           ORDER BY s.seat_number, s.id
                       ) AS inventory_number
                  FROM performance_details pd
                  JOIN performance_general pg ON pg.id = pd.performance_general_id
                  JOIN performance_areas pa
                    ON pa.performance_general_id = pd.performance_general_id
                  JOIN seats s ON s.area_id = pa.area_id
                 WHERE pg.ticketing_start_at <= now()
                   AND pd.performance_date > now()
                   AND pd.status IN ('SCHEDULED'::ticketing_status, 'OPEN'::ticketing_status)
                   AND pg.status IN ('UPCOMING'::performance_status, 'ONGOING'::performance_status)
            )
            INSERT INTO performance_seats
                (performance_detail_id, seat_id, status, updated_at)
            SELECT performance_detail_id, seat_id, 'AVAILABLE'::seat_booking_status, now()
              FROM inventory
             WHERE (sale_type = 'SEATED'::area_type OR inventory_number <= max_cnt)
            ON CONFLICT (performance_detail_id, seat_id) DO NOTHING
            """, nativeQuery = true)
    int insertMissingForOpenedSchedules();

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

    /**
     * <b>구역이 하나라도 매진된</b> 회차의 ID. 취소표 대기를 받을 수 있는 회차다.
     *
     * <p>{@link #findSeatCounts} 는 회차 전체가 매진됐는지를 보지만, 대기는 <b>구역 단위</b>다 —
     * A구역만 다 팔리고 B구역에 자리가 남은 회차에도 A구역 대기는 받아야 한다. 반대로 모든 구역에
     * 자리가 남아 있으면 대기를 받을 이유가 없다. 그냥 예매하면 되는 자리이기 때문이다.
     *
     * <p>회차마다 따로 물으면 N+1 이라 한 번에 묻는다. 좌석을 아직 만들지 않은 구역은 GROUP BY 에서
     * 빠지므로 매진으로 세지 않는다.
     */
    @Query(value = """
            SELECT DISTINCT sold.performance_detail_id
              FROM (
                    SELECT ps.performance_detail_id,
                           COUNT(*) FILTER (
                               WHERE ps.status = 'AVAILABLE'
                                  OR (ps.status = 'HELD' AND ps.held_until < now())
                           ) AS available_count
                      FROM performance_seats ps
                      JOIN seats s ON s.id = ps.seat_id
                     WHERE ps.performance_detail_id IN (:scheduleIds)
                     GROUP BY ps.performance_detail_id, s.area_id
                   ) sold
             WHERE sold.available_count = 0
            """, nativeQuery = true)
    List<Long> findScheduleIdsWithSoldOutArea(@Param("scheduleIds") Collection<Long> scheduleIds);

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

    /* ── 🔴 취소표 당첨 좌석은 일반 선점 경로가 건드리지 않는다 ──────────────
       추첨이 당첨자에게 넘긴 좌석은 평범한 선점과 <b>행 모양이 똑같다</b>
       (status=HELD · held_by=당첨자 · held_until=결제 기한). 상태 값을 늘리지 않으려고 그렇게
       뒀는데, 그래서 아래 네 쿼리가 그것을 자기 것인 줄 알고 가져가 버렸다:

         releaseHold          당첨자가 예매 화면에 들어가면 프론트가 "쥔 것 먼저 놓기" 로
                              당첨 좌석을 놓았다 → AVAILABLE → 매진이 풀려 아무나 예약 (2026-09-23 운영)
         releaseAllExpiredHolds  기한이 지난 뒤 "내 선점" 화면만 열어도 좌석이 풀렸다
         releaseExpiredHold   같은 이유로 새 좌석을 잡기 직전에 풀렸다
         hold                 기한 직후 몇 초 사이에 남이 그 좌석을 그냥 가져갔다

       한 번 풀리면 되돌릴 길이 없다 — 재추첨은 좌석을 HELD → SOLD 로 되찾아야 여는데
       (SeatDrawWriter.redraw) 이미 남의 것이 됐거나 팔려서 실패하고, 기다리던 사람들은
       그 자리를 영영 못 받는다.

       그래서 네 쿼리 모두에 "이 좌석에 진행 중인 추첨이 없을 것" 을 건다. 상태 목록은
       uq_seat_draws_active_seat 의 조건과 같다 — 그 인덱스가 곧 "좌석이 추첨의 것인 동안" 이다.
       당첨 좌석을 풀 수 있는 곳은 추첨 자신뿐이다 (reclaimWinnerHold · release).

       ⚠️ booking 의 SQL 이 resale 의 표를 읽는다. 도메인을 넘지만 컬럼을 새로 만들지 않는
          쪽을 골랐다 — 같은 사실을 두 군데 적으면 한쪽만 바뀌어 방어가 조용히 풀린다. */

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
               AND NOT EXISTS (
                     SELECT 1
                       FROM seat_draws d
                      WHERE d.performance_detail_id = performance_seats.performance_detail_id
                        AND d.seat_id = performance_seats.seat_id
                        AND d.status IN ('PENDING', 'OPEN', 'REVEALED'))
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
               AND NOT EXISTS (
                     SELECT 1
                       FROM seat_draws d
                      WHERE d.performance_detail_id = performance_seats.performance_detail_id
                        AND d.seat_id = performance_seats.seat_id
                        AND d.status IN ('PENDING', 'OPEN', 'REVEALED'))
            """, nativeQuery = true)
    int hold(@Param("performanceDetailId") Long performanceDetailId,
             @Param("seatId") Long seatId,
             @Param("userId") Long userId,
             @Param("heldUntil") LocalDateTime heldUntil);

    /**
     * 회차에 설정된 판매 구역이 실제 스탠딩 구역인지 확인한다.
     *
     * <p>단순히 {@code seats.area_id} 만 확인하면 좌석 구역의 좌석도 자동 배정할 수 있으므로,
     * 공연별 판매 설정인 {@code performance_areas.sale_type} 까지 함께 검증한다.
     */
    @Query(value = """
            SELECT EXISTS (
                SELECT 1
                  FROM performance_details pd
                  JOIN performance_areas pa
                    ON pa.performance_general_id = pd.performance_general_id
                 WHERE pd.id = :performanceDetailId
                   AND pa.area_id = :areaId
                   AND pa.sale_type = 'STANDING'::area_type
                   AND pa.price IS NOT NULL
            )
            """, nativeQuery = true)
    boolean existsSellableStandingArea(@Param("performanceDetailId") Long performanceDetailId,
                                       @Param("areaId") Long areaId);

    /**
     * 스탠딩 가상 좌석 하나를 서버가 골라 원자적으로 선점한다.
     *
     * <p>{@code locked_user} 로 같은 사용자의 중복 요청을 직렬화한다. 첫 요청이 끝난 뒤 두 번째 요청은
     * {@code existing} 에서 이미 잡은 좌석을 반환하므로, 더블 클릭이나 네트워크 재시도로 홀드가
     * 두 개 생기지 않고 만료 시각도 연장되지 않는다.
     *
     * <p>서로 다른 사용자는 {@code FOR UPDATE SKIP LOCKED} 로 같은 후보를 기다리지 않고 각자 다른
     * 가상 좌석을 고른다. 후보 선택과 UPDATE 는 한 SQL 문 안에서 실행되므로 클라이언트가 보았던
     * 오래된 {@code seatId} 때문에 충돌하는 창이 없다.
     */
    @Query(value = """
            WITH locked_user AS MATERIALIZED (
                SELECT u.id
                  FROM users u
                 WHERE u.id = :userId
                   FOR UPDATE
            ),
            existing AS MATERIALIZED (
                SELECT ps.seat_id, ps.held_until
                  FROM performance_seats ps
                  JOIN seats s ON s.id = ps.seat_id
                  CROSS JOIN locked_user
                 WHERE ps.performance_detail_id = :performanceDetailId
                   AND s.area_id = :areaId
                   AND ps.status = 'HELD'::seat_booking_status
                   AND ps.held_by = :userId
                   AND ps.held_until >= now()
                 LIMIT 1
            ),
            candidate AS MATERIALIZED (
                SELECT ps.performance_detail_id, ps.seat_id
                  FROM performance_seats ps
                  JOIN seats s ON s.id = ps.seat_id
                  JOIN performance_details pd ON pd.id = ps.performance_detail_id
                  JOIN performance_areas pa
                    ON pa.performance_general_id = pd.performance_general_id
                   AND pa.area_id = s.area_id
                  CROSS JOIN locked_user
                 WHERE ps.performance_detail_id = :performanceDetailId
                   AND s.area_id = :areaId
                   AND pa.sale_type = 'STANDING'::area_type
                   AND pa.price IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM existing)
                   AND (ps.status = 'AVAILABLE'::seat_booking_status
                        OR (ps.status = 'HELD'::seat_booking_status AND ps.held_until < now()))
                 ORDER BY s.seat_number, s.id
                   FOR UPDATE OF ps SKIP LOCKED
                 LIMIT 1
            ),
            allocated AS (
                UPDATE performance_seats ps
                   SET status = 'HELD'::seat_booking_status,
                       held_by = :userId,
                       held_until = :heldUntil,
                       updated_at = now()
                  FROM candidate c
                 WHERE ps.performance_detail_id = c.performance_detail_id
                   AND ps.seat_id = c.seat_id
                RETURNING ps.seat_id, ps.held_until
            )
            SELECT result.seat_id AS "seatId",
                   result.held_until AS "heldUntil",
                   GREATEST(EXTRACT(EPOCH FROM (result.held_until - now()))::bigint, 0)
                       AS "remainingSeconds"
              FROM (
                    SELECT seat_id, held_until FROM existing
                    UNION ALL
                    SELECT seat_id, held_until FROM allocated
              ) result
             LIMIT 1
            """, nativeQuery = true)
    Optional<StandingSeatAllocation> holdAvailableStandingSeat(
            @Param("performanceDetailId") Long performanceDetailId,
            @Param("areaId") Long areaId,
            @Param("userId") Long userId,
            @Param("heldUntil") LocalDateTime heldUntil);

    interface StandingSeatAllocation {
        Long getSeatId();

        LocalDateTime getHeldUntil();

        long getRemainingSeconds();
    }

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
               AND NOT EXISTS (
                     SELECT 1
                       FROM seat_draws d
                      WHERE d.performance_detail_id = performance_seats.performance_detail_id
                        AND d.seat_id = performance_seats.seat_id
                        AND d.status IN ('PENDING', 'OPEN', 'REVEALED'))
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
               AND NOT EXISTS (
                     SELECT 1
                       FROM seat_draws d
                      WHERE d.performance_detail_id = performance_seats.performance_detail_id
                        AND d.seat_id = performance_seats.seat_id
                        AND d.status IN ('PENDING', 'OPEN', 'REVEALED'))
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
                   pa.price                 AS "price",
                   /* 취소표 추첨이 맡긴 자리인가. 화면이 이것을 알아야 "자리 놓기" 를 감추고
                      당첨이라고 적을 수 있다 — 안 알려주면 평범한 선점으로 보여서 사용자가
                      스스로 놓으려 하고, 그 요청은 이제 ERR_BOOKING_014 로 거절된다 */
                   EXISTS (SELECT 1
                             FROM seat_draws d
                            WHERE d.performance_detail_id = ps.performance_detail_id
                              AND d.seat_id = ps.seat_id
                              AND d.status IN ('PENDING', 'OPEN', 'REVEALED'))
                                            AS "resaleWin"
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

        /** 취소표 당첨으로 받은 자리인가. 화면이 "자리 놓기" 를 감추는 데 쓴다 */
        boolean getResaleWin();
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

    /* ── 취소표 추첨 (resale) ──────────────────────────────────────────────
       취소된 좌석은 추첨이 도는 동안 SOLD 로 남는다 — 아무도 잡지 못한다. 난수가 확정되면
       당첨자에게 HELD(held_by = 당첨자, held_until = 결제 기한) 로 넘기고, 당첨자는 평소
       결제 흐름(open → confirm → sell)을 그대로 탄다. 상태 값을 늘리지 않은 이유다.

       clearAutomatically 를 쓰지 않는다 — 부르는 쪽(SeatDrawWriter)이 잠가 둔 추첨·신청 행을
       이어서 고친다. 컨텍스트를 비우면 그 변경이 조용히 사라진다. */

    /**
     * 취소된(SOLD) 좌석을 당첨자의 선점으로 넘긴다. 첫 당첨자에게만 쓴다.
     *
     * <p>{@code uq_performance_seats_held_by} 에 걸리면(당첨자가 같은 회차의 다른 좌석을 선점 중)
     * 예외가 나고 부르는 쪽이 다음 순위로 넘어간다.
     *
     * @return 1 이면 넘겼다. 0 이면 좌석이 SOLD 가 아니다 — 추첨이 좌석을 잃었다
     */
    @Modifying(flushAutomatically = true)
    @Query(value = """
            UPDATE performance_seats
               SET status = 'HELD',
                   held_by = :userId,
                   held_until = :heldUntil,
                   updated_at = now()
             WHERE performance_detail_id = :performanceDetailId
               AND seat_id = :seatId
               AND status = 'SOLD'
            """, nativeQuery = true)
    int grantSoldToWinner(@Param("performanceDetailId") Long performanceDetailId,
                          @Param("seatId") Long seatId,
                          @Param("userId") Long userId,
                          @Param("heldUntil") LocalDateTime heldUntil);

    /**
     * 기한을 넘기거나 포기한 당첨자의 선점을 <b>추첨의 손으로 되돌린다</b> (HELD → SOLD).
     *
     * <p>그 좌석은 곧바로 새 추첨으로 넘어가고, 새 당첨자에게 다시 {@link #grantSoldToWinner} 로 나간다.
     * 대기자가 없으면 부르는 쪽이 {@link #release} 로 일반 판매에 푼다.
     * {@code held_until} 조건이 없다 — 만료된 선점을 되돌리는 것이 이 메서드의 일이다.
     *
     * @return 1 이면 되돌렸다. 0 이면 당첨자가 그 사이 결제했거나(SOLD) 선점을 스스로 풀었다(AVAILABLE)
     */
    @Modifying(flushAutomatically = true)
    @Query(value = """
            UPDATE performance_seats
               SET status = 'SOLD',
                   held_by = NULL,
                   held_until = NULL,
                   updated_at = now()
             WHERE performance_detail_id = :performanceDetailId
               AND seat_id = :seatId
               AND status = 'HELD'
               AND held_by = :userId
            """, nativeQuery = true)
    int reclaimWinnerHold(@Param("performanceDetailId") Long performanceDetailId,
                          @Param("seatId") Long seatId,
                          @Param("userId") Long userId);

    /**
     * 구역별로 지금 고를 수 있는 좌석 수. 취소표 대기는 <b>이 값이 0 인 구역에만</b> 걸 수 있다.
     *
     * <p>만료된 HELD 는 고를 수 있는 좌석으로 친다 — {@link #findSeatCounts} 와 같은 기준이다.
     * 회차 좌석이 아직 없는 구역은 행이 없다.
     */
    @Query(value = """
            SELECT s.area_id AS "areaId",
                   COUNT(*)  AS "totalCount",
                   COUNT(*) FILTER (WHERE ps.status = 'AVAILABLE'
                                       OR (ps.status = 'HELD' AND ps.held_until < now()))
                             AS "availableCount"
              FROM performance_seats ps
              JOIN seats s ON s.id = ps.seat_id
             WHERE ps.performance_detail_id = :performanceDetailId
             GROUP BY s.area_id
            """, nativeQuery = true)
    List<AreaAvailabilityView> findAvailabilityByArea(@Param("performanceDetailId") Long performanceDetailId);

    /** {@link #findAvailabilityByArea} 결과 한 줄 */
    interface AreaAvailabilityView {
        Long getAreaId();

        long getTotalCount();

        long getAvailableCount();
    }
}
