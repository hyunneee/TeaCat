package com.teacat.server.analytics.repository;

import com.teacat.server.user.entity.User;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

/**
 * 회원 지표용 조회 전용 저장소.
 *
 * <p>{@code UserRepository} 에 넣지 않는 이유가 둘이다.
 * <ul>
 *   <li>여기 있는 건 회원을 다루는 쿼리가 아니라 <b>통계</b>다. 지표가 늘어날 때마다
 *       회원 도메인의 저장소가 부풀면 다음 사람이 회원 조회를 찾기 어려워진다.</li>
 *   <li>🔴 전부 네이티브 쿼리여야 한다. {@code User} 에는
 *       {@code @SQLRestriction("deleted_at is null")} 이 걸려 있어 JPQL 로는
 *       <b>탈퇴 회원을 셀 수 없다.</b> 일자별 탈퇴 수가 바로 그 값이다.</li>
 * </ul>
 *
 * <p>{@code JpaRepository} 가 아니라 {@code Repository} 를 상속한다 — 저장·삭제 메서드를
 * 노출하지 않기 위해서다. 통계는 읽기만 한다.
 *
 * <p>세는 대상은 {@code role = 'USER'} 뿐이다. 운영진 계정은 서비스 회원이 아니다.
 */
public interface MemberStatsRepository extends Repository<User, Long> {

    /** 일자별 가입 수. 나중에 탈퇴했어도 "그날 가입한" 것은 사실이므로 빼지 않는다 */
    @Query(value = """
            SELECT CAST(u.created_at AS date) AS bucket, COUNT(*) AS total
              FROM users u
             WHERE u.role = 'USER'
               AND u.created_at >= CAST(:from AS date)
               AND u.created_at < CAST(:to AS date) + INTERVAL '1 day'
             GROUP BY CAST(u.created_at AS date)
            """, nativeQuery = true)
    List<DailyCountProjection> countDailySignups(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** 일자별 탈퇴 수 (소프트 삭제 시각 기준) */
    @Query(value = """
            SELECT CAST(u.deleted_at AS date) AS bucket, COUNT(*) AS total
              FROM users u
             WHERE u.role = 'USER'
               AND u.deleted_at IS NOT NULL
               AND u.deleted_at >= CAST(:from AS date)
               AND u.deleted_at < CAST(:to AS date) + INTERVAL '1 day'
             GROUP BY CAST(u.deleted_at AS date)
            """, nativeQuery = true)
    List<DailyCountProjection> countDailyWithdrawals(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * 조회 구간이 시작되기 <b>직전</b>의 회원 수.
     *
     * <p>누적 곡선의 출발점이다. 이 값이 없으면 구간 안의 가입만 더하게 되어
     * "최근 30일" 을 보든 "최근 7일" 을 보든 곡선이 0 에서 시작한다.
     *
     * <p>그 시점에 살아 있던 회원이므로, 그 뒤에 탈퇴한 사람도 포함해야 한다.
     */
    @Query(value = """
            SELECT COUNT(*)
              FROM users u
             WHERE u.role = 'USER'
               AND u.created_at < CAST(:from AS date)
               AND (u.deleted_at IS NULL OR u.deleted_at >= CAST(:from AS date))
            """, nativeQuery = true)
    long countMembersBefore(@Param("from") LocalDate from);

    /** 지금 살아 있는 일반 회원 수 */
    @Query(value = "SELECT COUNT(*) FROM users u WHERE u.role = 'USER' AND u.deleted_at IS NULL",
            nativeQuery = true)
    long countActiveMembers();

    /** 그중 얼굴을 등록한 회원 수. 티켓 사용(입장)의 전제 조건이라 전환율로 본다 */
    @Query(value = """
            SELECT COUNT(*)
              FROM users u
             WHERE u.role = 'USER'
               AND u.deleted_at IS NULL
               AND u.face_id IS NOT NULL
            """, nativeQuery = true)
    long countActiveMembersWithFace();
}
