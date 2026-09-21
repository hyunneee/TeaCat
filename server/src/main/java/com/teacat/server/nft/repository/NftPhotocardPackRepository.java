package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftPhotocardPack;
import com.teacat.server.nft.entity.NftPhotocardPackSource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NftPhotocardPackRepository extends JpaRepository<NftPhotocardPack, Long> {

    /**
     * 안 쓴 팩 하나를 잠근다. 지금 열 수 있는 것만 대상이다.
     *
     * <p>개봉 시각은 저장돼 있지 않다 — 회차의 공연 일시에서 계산한다. 그래서 공연을 연기하면
     * 개봉도 함께 밀리고, 예매 취소 마감과 어긋나지 않는다.
     *
     * <p>{@code SKIP LOCKED} 라 같은 사용자의 동시 요청은 서로 다른 팩을 잠근다. 팩이 하나뿐이면
     * 둘째 요청은 잠글 행이 없어 비어 온다 — 그게 "팩 없음" 이다. 기다리지 않으므로 교착도 없다.
     *
     * <p>{@code FOR UPDATE OF p} 인 이유: PostgreSQL 은 외부 조인의 nullable 쪽(여기서는 d)을
     * 잠글 수 없다. 그냥 {@code FOR UPDATE} 로 쓰면 실행 시 에러가 난다.
     */
    @Query(value = """
            SELECT p.* FROM nft_photocard_packs p
              LEFT JOIN performance_details d ON d.id = p.performance_detail_id
             WHERE p.user_id = :userId AND p.consumed_at IS NULL
               AND (p.performance_detail_id IS NULL
                    OR d.performance_date - (:leadSeconds * interval '1 second') <= now())
             ORDER BY p.id
             LIMIT 1
             FOR UPDATE OF p SKIP LOCKED
            """, nativeQuery = true)
    Optional<NftPhotocardPack> lockOneAvailable(@Param("userId") Long userId,
                                                @Param("leadSeconds") long leadSeconds);

    /** 같은 키로 이미 뽑았나. 있으면 그 팩의 photocardId 가 그때 준 카드다 */
    Optional<NftPhotocardPack> findByUserIdAndIdempotencyKey(Long userId, UUID idempotencyKey);

    /* 2026-09-11: countOpenable 로 대체했다. 개봉 시각이 생겨 "안 쓴 팩" 과 "지금 열 수 있는 팩" 이
       달라졌고, 파생 쿼리로는 available_at 조건을 붙일 수 없다.
    long countByUserIdAndConsumedAtIsNull(Long userId);
    */

    /** 지금 열 수 있는 팩 수. 회차가 없는 팩(이벤트)은 언제나 열 수 있다 */
    @Query(value = """
            SELECT count(*) FROM nft_photocard_packs p
              LEFT JOIN performance_details d ON d.id = p.performance_detail_id
             WHERE p.user_id = :userId AND p.consumed_at IS NULL
               AND (p.performance_detail_id IS NULL
                    OR d.performance_date - (:leadSeconds * interval '1 second') <= now())
            """, nativeQuery = true)
    long countOpenable(@Param("userId") Long userId, @Param("leadSeconds") long leadSeconds);

    /** 아직 안 열린 팩 수. 결제 직후 "카드팩 1개 · 오픈 예정" 이 이 값이다 */
    @Query(value = """
            SELECT count(*) FROM nft_photocard_packs p
              JOIN performance_details d ON d.id = p.performance_detail_id
             WHERE p.user_id = :userId AND p.consumed_at IS NULL
               AND d.performance_date - (:leadSeconds * interval '1 second') > now()
            """, nativeQuery = true)
    long countScheduled(@Param("userId") Long userId, @Param("leadSeconds") long leadSeconds);

    /** 가장 빨리 열리는 시각. 잠긴 팩이 없으면 null */
    @Query(value = """
            SELECT min(d.performance_date - (:leadSeconds * interval '1 second'))
              FROM nft_photocard_packs p
              JOIN performance_details d ON d.id = p.performance_detail_id
             WHERE p.user_id = :userId AND p.consumed_at IS NULL
               AND d.performance_date - (:leadSeconds * interval '1 second') > now()
            """, nativeQuery = true)
    LocalDateTime findNextOpenAt(@Param("userId") Long userId, @Param("leadSeconds") long leadSeconds);

    /**
     * 안 쓴 팩 목록 — **팩마다** 개봉 시각과 지금 열 수 있는지를 함께 돌려준다.
     *
     * <p>개봉 시각({@code open_at})은 저장된 값이 아니라 <b>이 쿼리가 회차의 공연 일시에서 계산</b>한다
     * ({@code lockOneAvailable}·{@code countOpenable} 과 같은 식). 값을 얼려 두면 공연을 연기했을 때
     * 예매 취소 마감과 어긋난다 ({@code NftPhotocardPack#performanceDetailId} 주석).
     *
     * <p>{@code openable} 도 SQL 안(DB 시계)에서 판정한다. 자바에서 다시 비교하면 뽑기 API 와
     * 다른 시계로 답하게 된다. 이벤트 팩은 회차가 없어 {@code open_at} 이 null 이고 언제나 열린다.
     *
     * <p>🔴 {@code LIMIT} 이 있다. 팩은 예매 한 건당 하나라 오래 쓴 계정은 많아질 수 있고, 화면이 그리는 것은
     * 가장 빨리 열리는 몇 개뿐이다. 전체 개수는 {@link #countOpenable}·{@link #countScheduled} 가 따로 답한다.
     * 정렬은 <b>열 수 있는 것(open_at 이 지났거나 null)이 먼저, 그다음 개봉이 이른 순</b>이다.
     */
    @Query(value = """
            SELECT p.id                         AS packId,
                   p.source::text               AS source,
                   pg.title                     AS performanceTitle,
                   ev.name                      AS eventName,
                   d.performance_date - (:leadSeconds * interval '1 second') AS openAt,
                   (p.performance_detail_id IS NULL
                    OR d.performance_date - (:leadSeconds * interval '1 second') <= now()) AS openable
              FROM nft_photocard_packs p
              LEFT JOIN performance_details d ON d.id = p.performance_detail_id
              LEFT JOIN performance_general pg ON pg.id = d.performance_general_id
              LEFT JOIN nft_photocard_pack_events ev
                     ON p.source = 'EVENT' AND ev.code = p.source_ref
             WHERE p.user_id = :userId AND p.consumed_at IS NULL
             ORDER BY d.performance_date - (:leadSeconds * interval '1 second') NULLS FIRST, p.id
             LIMIT :limit
            """, nativeQuery = true)
    List<PackRow> findUnconsumedPacks(@Param("userId") Long userId,
                                      @Param("leadSeconds") long leadSeconds,
                                      @Param("limit") int limit);

    /** {@link #findUnconsumedPacks} 한 줄. 이벤트 팩은 {@code openAt}·{@code performanceTitle} 이 null */
    interface PackRow {
        Long getPackId();

        String getSource();

        String getPerformanceTitle();

        String getEventName();

        /** 개봉 시각. 회차가 없는 팩(이벤트)은 null */
        java.time.LocalDateTime getOpenAt();

        boolean getOpenable();
    }

    boolean existsByUserIdAndSourceAndSourceRef(Long userId, NftPhotocardPackSource source, String sourceRef);

    /** 이 티켓으로 받은 팩을 이미 썼는가. 카드가 나갔다면 예매를 되돌릴 수 없다 */
    boolean existsByUserIdAndSourceAndSourceRefAndConsumedAtIsNotNull(
            Long userId, NftPhotocardPackSource source, String sourceRef);

    /**
     * 아직 안 쓴 팩을 지운다. 예매 취소가 부른다.
     *
     * <p>이미 소비된 팩이면 취소 자체를 거절해야 한다 — 그 판정은 여기가 아니라
     * {@code TicketCancelRecorder.invalidate} 가 이 메서드를 부르기 전에 한다. 그래도
     * {@code consumedAt is null} 을 거는 이유는, 그 판정이 깨졌다면 조용히 지우는 것보다
     * 남아서 이상을 드러내는 편이 낫기 때문이다.
     *
     * <p>{@code flushAutomatically = true} 가 필요하다 — 같은 트랜잭션에서 먼저 바꾼
     * {@code ticket.cancel()} / {@code order.markCanceled()} 가 flush 되지 않은 채로 이 벌크
     * delete 가 실행되면, 그 변경이 DB에 한 번도 반영되지 않고 사라진다(취소했는데 상태가
     * 그대로인 버그로 실제로 재현됐다).
     *
     * <p>{@code clearAutomatically} 는 쓰지 않는다 — 이 메서드는 {@code NftPhotocardPack}
     * 엔티티를 미리 로드하지 않으므로 비워야 할 1차 캐시가 애초에 없다. 대신 clear 는 같은
     * 트랜잭션이 들고 있던 {@code order}/{@code ticket} 도 detach 시켜서, 호출 이후에 그 엔티티의
     * lazy 필드를 건드리면 {@code LazyInitializationException} 이 난다.
     */
    @Modifying(flushAutomatically = true)
    @Query("""
            delete from NftPhotocardPack p
             where p.userId = :userId and p.source = :source and p.sourceRef = :sourceRef
               and p.consumedAt is null
            """)
    int deleteUnconsumed(@Param("userId") Long userId,
                         @Param("source") NftPhotocardPackSource source,
                         @Param("sourceRef") String sourceRef);

    /** 이 이벤트 코드로 지급된 팩 수. 어드민 단건 응답이 쓴다 */
    long countBySourceAndSourceRef(NftPhotocardPackSource source, String sourceRef);

    /**
     * 출처 값별 지급 수. 어드민 목록이 이벤트마다 세지 않고 한 번에 가져간다.
     *
     * <p>{@code Object[]} 로 받는 이유: 네이티브 인터페이스 프로젝션은 PostgreSQL 이 따옴표 없는
     * 별칭을 소문자로 내려 매핑이 조용히 깨질 수 있다. 두 칸짜리 결과라 배열이 더 안전하다.
     */
    @Query("""
            select p.sourceRef, count(p) from NftPhotocardPack p
             where p.source = :source
             group by p.sourceRef
            """)
    List<Object[]> countGroupedBySourceRef(@Param("source") NftPhotocardPackSource source);
}
