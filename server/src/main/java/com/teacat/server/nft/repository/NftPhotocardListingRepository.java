package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftListingStatus;
import com.teacat.server.nft.entity.NftPhotocardListing;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.Collection;

public interface NftPhotocardListingRepository extends JpaRepository<NftPhotocardListing, Long> {

    Optional<NftPhotocardListing> findByPhotocardIdAndStatus(Long photocardId, NftListingStatus status);

    boolean existsByPhotocardIdAndStatus(Long photocardId, NftListingStatus status);

    boolean existsByPhotocardIdAndStatusIn(Long photocardId, Collection<NftListingStatus> statuses);

    boolean existsByPhotocardId(Long photocardId);
}
