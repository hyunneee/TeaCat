package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftPhotocardDesign;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NftPhotocardDesignRepository extends JpaRepository<NftPhotocardDesign, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from NftPhotocardDesign d where d.id in :ids order by d.id")
    List<NftPhotocardDesign> findAllByIdForUpdate(@Param("ids") List<Long> ids);
}

