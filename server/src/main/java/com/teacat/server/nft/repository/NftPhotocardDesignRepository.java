package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftDesignChainStatus;
import com.teacat.server.nft.entity.NftPhotocardDesign;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NftPhotocardDesignRepository extends JpaRepository<NftPhotocardDesign, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from NftPhotocardDesign d where d.id in :ids order by d.id")
    List<NftPhotocardDesign> findAllByIdForUpdate(@Param("ids") List<Long> ids);

    /**
     * 등록 상태를 바꾸는 경로가 셋이라(생성·재시도·확정 감시) 행을 잠그고 읽는다.
     * 잠그지 않으면 감시가 REGISTERED 로 쓴 직후 재시도가 옛 상태를 보고 다시 보낸다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from NftPhotocardDesign d where d.id = :id")
    Optional<NftPhotocardDesign> findByIdForUpdate(@Param("id") Long id);

    /* 2026-09-11: findAllByDrawPoolTrueAndPerformanceIdIsNullOrderByIdAsc 로 대체했다.
       공연별 도안이 생기면서 이 조회에 그것까지 섞여 나온다.
    List<NftPhotocardDesign> findAllByDrawPoolTrueOrderByIdAsc();
    */

    /** 이벤트 팩이 뽑는 풀 목록. 공연별 도안은 빠진다 */
    List<NftPhotocardDesign> findAllByDrawPoolTrueAndPerformanceIdIsNullOrderByIdAsc();

    /* 2026-09-11: findAllByPerformanceIdAndDrawPoolFalseOrderByIdAsc 로 대체했다.
       호출부가 둘이었고(어드민 목록 · 회차 발급 배정) 둘 다 뽑기 풀 도안이 섞이면 안 된다.
       발급에 섞이면 티켓 보유자에게 직접 발급되어 그 공연 팩에서 뽑을 카드가 사라진다.
    List<NftPhotocardDesign> findAllByPerformanceIdOrderByIdAsc(Long performanceId);
    */

    /** 공연 전용 도안 목록(자동 발급용). 뽑기 풀 도안은 빠진다 */
    List<NftPhotocardDesign> findAllByPerformanceIdAndDrawPoolFalseOrderByIdAsc(Long performanceId);

    /** 그 공연의 뽑기 풀 도안. 공연 전용 도안(draw_pool = false)은 빠진다 */
    List<NftPhotocardDesign> findAllByPerformanceIdAndDrawPoolTrueOrderByIdAsc(Long performanceId);

    /** 같은 템플릿이 이미 그 공연에 들어갔나 */
    boolean existsByPerformanceIdAndTemplateId(Long performanceId, Long templateId);

    /**
     * 같은 템플릿이 이미 이벤트 풀에 들어갔나.
     *
     * <p>Spring Data 파생 쿼리는 인자가 null 이면 {@code = null} 이 아니라 {@code IS NULL} 로
     * 번역하므로 {@code existsByPerformanceIdAndTemplateId(null, ...)} 도 실제로 동작한다
     * (돌연변이 테스트로 확인했다). 그래도 이름으로 의도를 박아 두는 쪽을 쓴다 — 이벤트 풀은
     * "공연이 없는 것" 이 조건 자체이고, 호출부가 null 을 넘기는 형태면 나중에 읽는 사람이
     * 3값 논리를 의심하게 된다. {@code @Query} 로 쓴 JPQL·네이티브에는 이 자동 변환이 없어
     * 거기서는 정말로 {@code = null} 이 되니 헷갈리지 말 것.
     */
    boolean existsByPerformanceIdIsNullAndTemplateId(Long templateId);

    /**
     * 이벤트 팩이 뽑을 후보 하나를 잠근다 — <b>이벤트 풀(공연 없는 도안)만</b>이다.
     *
     * <p>🔴 {@code performance_general_id IS NULL} 이 없으면 공연별 도안까지 후보에 섞인다.
     * 그러면 이벤트 팩을 여는 사람이 어느 공연 것도 아닌 카드를 가져가고 <b>그 공연 관객의 몫이
     * 줄어든다</b> — 공연 전에 다 소진되면 그 공연 관객이 못 뽑는다.
     *
     * <p>Java 에서 고르고 잠그면 "고른 뒤 잠그기 전에 소진" 을 재시도로 다뤄야 하고, 한 트랜잭션이
     * 도안 잠금을 두 개 들면 교착이 가능하다. 여기서는 남은 후보 중 지금 잠기지 않은 하나를 DB 가
     * 골라 잠근다.
     *
     * <p>미등록(REGISTERED 아님) 도안은 발행 배치를 깨뜨리므로 후보에서 뺀다.
     */
    @Query(value = """
            SELECT * FROM nft_photocard_designs
             WHERE draw_pool
               AND performance_general_id IS NULL
               AND chain_status = 'REGISTERED'
               AND issued_supply < total_supply
             ORDER BY random()
             LIMIT 1
             FOR UPDATE SKIP LOCKED
            """, nativeQuery = true)
    Optional<NftPhotocardDesign> lockRandomDrawCandidate();

    /**
     * 티켓 팩이 뽑을 후보 하나를 잠근다 — <b>그 회차가 속한 공연의 도안만</b>이다.
     *
     * <p>🔴 이 공연에 카드를 안 넣었으면 비어 온다. 그때 <b>이벤트 풀로 떨어뜨리지 않는다</b> —
     * 이벤트 풀은 이벤트 팩의 재고이고, 거기서 뽑으면 이벤트 수량이 엉뚱하게 줄고 그 카드는 어느
     * 공연 것도 아닌 물건이 된다. 부르는 쪽이 {@code DRAW_POOL_EMPTY} 로 실패시킨다.
     *
     * <p>{@code FOR UPDATE OF d} 인 이유: 조인한 {@code performance_details} 는 잠글 대상이 아니다.
     */
    @Query(value = """
            SELECT d.* FROM nft_photocard_designs d
              JOIN performance_details pd ON pd.performance_general_id = d.performance_general_id
             WHERE pd.id = :performanceDetailId
               AND d.draw_pool
               AND d.chain_status = 'REGISTERED'
               AND d.issued_supply < d.total_supply
             ORDER BY random()
             LIMIT 1
             FOR UPDATE OF d SKIP LOCKED
            """, nativeQuery = true)
    Optional<NftPhotocardDesign> lockRandomDrawCandidateForSchedule(
            @Param("performanceDetailId") Long performanceDetailId);

    /** 확정 감시가 훑을 대상: 트랜잭션은 보냈는데 아직 결과를 못 본 도안 */
    @Query(value = """
            SELECT id FROM nft_photocard_designs
             WHERE chain_status = 'REGISTERING'
             ORDER BY id
             LIMIT :limit
            """, nativeQuery = true)
    List<Long> findRegisteringIds(@Param("limit") int limit);

    /**
     * 온체인 등록 상태별 도안 수.
     *
     * <p>REGISTERING 이 쌓이면 확정 감시(NftDesignRegistrationSweeper)가 멈춘 것이고,
     * 그 상태로 발행을 걸면 NFT_037 로 배치 전체가 막힌다.
     */
    @Query("select d.chainStatus as status, count(d) as count from NftPhotocardDesign d group by d.chainStatus")
    List<ChainStatusCount> countGroupByChainStatus();

    interface ChainStatusCount {
        NftDesignChainStatus getStatus();

        long getCount();
    }
}
