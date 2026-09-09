package com.teacat.server.nft.repository;

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

    /** 확정 감시가 훑을 대상: 트랜잭션은 보냈는데 아직 결과를 못 본 도안 */
    @Query(value = """
            SELECT id FROM nft_photocard_designs
             WHERE chain_status = 'REGISTERING'
             ORDER BY id
             LIMIT :limit
            """, nativeQuery = true)
    List<Long> findRegisteringIds(@Param("limit") int limit);
}
