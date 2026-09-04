package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftListingStatus;
import com.teacat.server.nft.entity.NftPhotocardListing;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface NftPhotocardListingRepository extends JpaRepository<NftPhotocardListing, Long> {

    Optional<NftPhotocardListing> findByPhotocardIdAndStatus(Long photocardId, NftListingStatus status);

    boolean existsByPhotocardIdAndStatus(Long photocardId, NftListingStatus status);

    boolean existsByPhotocardId(Long photocardId);
}
