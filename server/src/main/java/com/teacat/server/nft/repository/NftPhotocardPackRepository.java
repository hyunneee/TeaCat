package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftPhotocardPack;
import com.teacat.server.nft.entity.NftPhotocardPackSource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface NftPhotocardPackRepository extends JpaRepository<NftPhotocardPack, Long> {

    /**
     * 안 쓴 팩 하나를 잠근다.
     *
     * <p>{@code SKIP LOCKED} 라 같은 사용자의 동시 요청은 서로 다른 팩을 잠근다. 팩이 하나뿐이면
     * 둘째 요청은 잠글 행이 없어 비어 온다 — 그게 "팩 없음" 이다. 기다리지 않으므로 교착도 없다.
     */
    @Query(value = """
            SELECT * FROM nft_photocard_packs
             WHERE user_id = :userId AND consumed_at IS NULL
             ORDER BY id
             LIMIT 1
             FOR UPDATE SKIP LOCKED
            """, nativeQuery = true)
    Optional<NftPhotocardPack> lockOneAvailable(@Param("userId") Long userId);

    /** 같은 키로 이미 뽑았나. 있으면 그 팩의 photocardId 가 그때 준 카드다 */
    Optional<NftPhotocardPack> findByUserIdAndIdempotencyKey(Long userId, UUID idempotencyKey);

    long countByUserIdAndConsumedAtIsNull(Long userId);

    boolean existsByUserIdAndSourceAndSourceRef(Long userId, NftPhotocardPackSource source, String sourceRef);
}
