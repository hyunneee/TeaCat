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

    List<NftPhotocardDesign> findAllByPerformanceIdOrderByIdAsc(Long performanceId);

    /** 어드민이 보는 뽑기 풀 목록 (등록 상태·남은 수량 확인용) */
    List<NftPhotocardDesign> findAllByDrawPoolTrueOrderByIdAsc();

    /**
     * 뽑기 후보 중 하나를 <b>무작위로 골라 잠근다.</b> 한 문장이다.
     *
     * <p>Java 에서 고르고 잠그면 "고른 뒤 잠그기 전에 소진" 을 재시도로 다뤄야 하고, 한 트랜잭션이
     * 도안 잠금을 두 개 들면 교착이 가능하다. 여기서는 남은 후보 중 지금 잠기지 않은 하나를 DB 가
     * 골라 잠근다. 후보가 수백 행이라 {@code random()} 정렬 비용은 무시할 수 있다.
     *
     * <p>미등록(REGISTERED 아님) 도안은 발행 배치를 깨뜨리므로 후보에서 뺀다.
     */
    @Query(value = """
            SELECT * FROM nft_photocard_designs
             WHERE draw_pool
               AND chain_status = 'REGISTERED'
               AND issued_supply < total_supply
             ORDER BY random()
             LIMIT 1
             FOR UPDATE SKIP LOCKED
            """, nativeQuery = true)
    Optional<NftPhotocardDesign> lockRandomDrawCandidate();

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
