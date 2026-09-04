package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftPhotocardTrade;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface NftPhotocardTradeRepository extends JpaRepository<NftPhotocardTrade, Long> {

    Optional<NftPhotocardTrade> findByBuyerIdAndIdempotencyKey(Long buyerId, UUID idempotencyKey);
}

