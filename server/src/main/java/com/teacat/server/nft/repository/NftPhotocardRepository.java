package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftPhotocard;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface NftPhotocardRepository extends JpaRepository<NftPhotocard, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from NftPhotocard p where p.id = :photocardId")
    Optional<NftPhotocard> findByIdForUpdate(@Param("photocardId") Long photocardId);

    boolean existsByDesignPerformanceId(Long performanceId);
}
