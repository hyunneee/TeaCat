package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftTradeRiskFeature;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface NftTradeRiskFeatureRepository extends JpaRepository<NftTradeRiskFeature, Long> {

    Optional<NftTradeRiskFeature> findByTradeId(Long tradeId);

    boolean existsByTradeId(Long tradeId);
}
