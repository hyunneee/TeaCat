package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftAuction;
import com.teacat.server.nft.entity.NftAuctionStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NftAuctionRepository extends JpaRepository<NftAuction, Long> {

    /** 입찰·즉시구매의 직렬화 지점. 한 경매의 상태 변경은 이 락을 잡은 뒤에만 한다 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from NftAuction a where a.id = :auctionId")
    Optional<NftAuction> findByIdForUpdate(@Param("auctionId") Long auctionId);

    /**
     * 마감 권한 획득. "진행 중이고 마감 시각이 지난" 경매만 잠근다.
     *
     * <p>비어 있으면 아직 마감 전이거나 이미 누가 닫은 것이다 — 호출자는 아무것도 하지 않는다.
     * 동시에 둘이 들어와도 락을 기다린 쪽은 갱신된 행으로 조건을 재평가해(EvalPlanQual) 빈 결과를 본다.
     * 마감 판정은 DB now() 로만 한다.
     */
    @Query(value = """
            SELECT * FROM nft_auctions
             WHERE id = :auctionId
               AND status = 'ACTIVE'
               AND ends_at <= now()
               FOR UPDATE
            """, nativeQuery = true)
    Optional<NftAuction> findExpiredActiveForUpdate(@Param("auctionId") Long auctionId);

    /** 스위퍼가 훑을 대상. 마감이 오래 지난 것부터 */
    @Query(value = """
            SELECT id FROM nft_auctions
             WHERE status = 'ACTIVE'
               AND ends_at <= now()
             ORDER BY ends_at, id
             LIMIT :limit
            """, nativeQuery = true)
    List<Long> findExpiredActiveIds(@Param("limit") int limit);

    boolean existsByPhotocardIdAndStatus(Long photocardId, NftAuctionStatus status);

    boolean existsByPhotocardIdAndStatusIn(Long photocardId, List<NftAuctionStatus> statuses);

    /**
     * 판매자 취소. 권한·상태·입찰 유무를 WHERE 에 넣어 한 번에 판정한다 (booking.releaseHold 와 같은 방식).
     *
     * @return 1 이면 취소 성공, 0 이면 실패 — 사유는 경매를 다시 읽어 판별한다
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE nft_auctions
               SET status = 'CANCELLED',
                   closed_at = now(),
                   updated_at = now()
             WHERE id = :auctionId
               AND seller_id = :sellerId
               AND status = 'ACTIVE'
               AND bid_count = 0
            """, nativeQuery = true)
    int cancelIfNoBids(@Param("auctionId") Long auctionId, @Param("sellerId") Long sellerId);
}
