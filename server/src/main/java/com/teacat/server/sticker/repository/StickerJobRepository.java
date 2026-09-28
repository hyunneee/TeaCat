package com.teacat.server.sticker.repository;

import com.teacat.server.sticker.entity.StickerJob;
import com.teacat.server.sticker.entity.StickerJobStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface StickerJobRepository extends JpaRepository<StickerJob, Long>, StickerJobClaimRepository {

    /** 같은 키로 다시 오면 새로 만들지 않고 그때 준 작업을 돌려준다 */
    Optional<StickerJob> findByUserIdAndIdempotencyKey(Long userId, String idempotencyKey);

    /**
     * 오늘 몫. 🔴 경계는 <b>호출하는 쪽이 KST 로 계산해</b> 넘긴다.
     *
     * <p>DB 컨테이너는 UTC, 앱 컨테이너는 {@code TZ=Asia/Seoul} 이라 SQL 안에서
     * {@code now()::date} 로 자르면 매일 09시 이전 요청이 어제 몫으로 세어진다.
     */
    @Query("""
            select count(j) from StickerJob j
             where j.user.id = :userId
               and j.status <> :excluded
               and j.createdAt >= :from
               and j.createdAt < :to
            """)
    long countBetween(@Param("userId") Long userId,
                      @Param("from") OffsetDateTime from,
                      @Param("to") OffsetDateTime to,
                      @Param("excluded") StickerJobStatus excluded);

    /** 실패한 작업은 오늘 몫을 쓰지 않는다 — 워커 장애로 사용자 몫이 깎이면 안 된다 */
    default long countUsedToday(Long userId, OffsetDateTime from, OffsetDateTime to) {
        return countBetween(userId, from, to, StickerJobStatus.FAILED);
    }

    /**
     * 워커가 보낸 기록을 {@code params_json} 에 넣는다.
     *
     * <p>🔴 <b>엔티티 필드가 아니라 명시적 캐스트다.</b> 하이버네이트의 JSON 매핑은 이 값을
     * 한 번 더 JSON 문자열로 감쌀 수 있고, 이 프로젝트는 Jackson 3 라 하이버네이트가 기대하는
     * 포맷 매퍼가 없을 수도 있다. 우리가 읽지도 않는 값 때문에 그 불확실성을 떠안지 않는다.
     *
     * <p>{@code clearAutomatically} 를 켜지 않는다 — 부르는 쪽이 방금 바꾼 엔티티를
     * 떼어내면 그 변경이 사라진다. {@code flushAutomatically} 로 먼저 내보내기만 한다.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = "UPDATE sticker_jobs SET params_json = CAST(:meta AS jsonb) WHERE id = :id",
            nativeQuery = true)
    void saveMeta(@Param("id") Long id, @Param("meta") String meta);

    /**
     * 집어갔다 소식이 끊긴 작업을 다시 줄 세운다.
     *
     * <p>🔴 {@link #failExhausted} 를 <b>먼저</b> 부를 것. 뒤집으면 {@code retry_count} 가
     * 이번 판에 상한에 닿은 작업이 같은 판의 소진 검사에 또 걸려, 한 번도 재시도하지 못하고 FAILED 가 된다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE sticker_jobs
               SET status = 'PENDING', retry_count = retry_count + 1,
                   claimed_at = NULL, worker_id = NULL
             WHERE status = 'RUNNING'
               AND claimed_at < :deadline
               AND retry_count < :maxRetry
            """, nativeQuery = true)
    int requeueStalled(@Param("deadline") OffsetDateTime deadline, @Param("maxRetry") int maxRetry);

    /** 되돌림을 다 쓴 작업을 포기한다 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE sticker_jobs
               SET status = 'FAILED', fail_reason = 'RETRY_EXHAUSTED', finished_at = now()
             WHERE status = 'RUNNING'
               AND claimed_at < :deadline
               AND retry_count >= :maxRetry
            """, nativeQuery = true)
    int failExhausted(@Param("deadline") OffsetDateTime deadline, @Param("maxRetry") int maxRetry);

    /**
     * 🔴 아무도 집어가지 않은 작업을 포기한다.
     *
     * <p>원래 스위퍼 설계에 없던 판이다. 워커가 <b>아예 안 떠 있으면</b> 작업은 RUNNING 이
     * 되질 않아 위 두 판에 걸리지 않고, 화면은 영원히 "그리고 있어요" 에 멈춘다.
     * 발표 당일 노트북을 안 띄운 경우가 정확히 여기다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE sticker_jobs
               SET status = 'FAILED', fail_reason = 'NO_WORKER', finished_at = now()
             WHERE status = 'PENDING'
               AND created_at < :deadline
            """, nativeQuery = true)
    int failAbandoned(@Param("deadline") OffsetDateTime deadline);

    /**
     * 돈을 받았는데 실패한 건 — 아직 안 돌려준 것만.
     *
     * <p>🔴 <b>실패 경로가 셋이라 상태로 찾는다</b>(재시도 소진 · 워커 없음 · 워커 신고).
     * 경로마다 환불 코드를 심으면 한 곳을 빠뜨리고, 그건 돈이 안 돌아가는 사고다.
     *
     * <p>한 번에 많이 집지 않는다 — 환불은 체인 호출이라 한 판에 몰아 돌리면 스위퍼가 길어진다.
     */
    List<StickerJob> findTop50ByStatusAndPaidCatGreaterThanAndRefundedAtIsNull(
            StickerJobStatus status, int minPaidCat);
}
