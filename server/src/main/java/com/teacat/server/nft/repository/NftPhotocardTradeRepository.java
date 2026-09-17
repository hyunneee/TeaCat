package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftPhotocardTrade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.List;

import java.util.Optional;
import java.util.UUID;

public interface NftPhotocardTradeRepository extends JpaRepository<NftPhotocardTrade, Long> {

    Optional<NftPhotocardTrade> findByBuyerIdAndIdempotencyKey(Long buyerId, UUID idempotencyKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from NftPhotocardTrade t where t.id = :tradeId")
    Optional<NftPhotocardTrade> findByIdForUpdate(@Param("tradeId") Long tradeId);

    @Query(value = """
            SELECT id FROM nft_photocard_trades
             WHERE chain_status IN ('PENDING', 'CAT_SUBMITTED', 'CAT_CONFIRMED', 'NFT_SUBMITTED',
                                    'COMPENSATING', 'REFUND_SUBMITTED')
               AND (next_retry_at IS NULL OR next_retry_at <= now())
             ORDER BY id
             LIMIT :limit
            """, nativeQuery = true)
    List<Long> findSettlementWork(@Param("limit") int limit);
}
