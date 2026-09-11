package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftMintStatus;
import com.teacat.server.nft.entity.NftPhotocard;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface NftPhotocardRepository extends JpaRepository<NftPhotocard, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from NftPhotocard p where p.id = :photocardId")
    Optional<NftPhotocard> findByIdForUpdate(@Param("photocardId") Long photocardId);

    boolean existsByDesignPerformanceId(Long performanceId);

    /**
     * 상태별 카드 수. 발행 파이프라인이 막혔는지 보는 지표의 원천이다
     * (NftChainPipelineMetrics). 인터페이스 프로젝션이라 별도 DTO 가 필요 없다.
     */
    @Query("select p.status as status, count(p) as count from NftPhotocard p group by p.status")
    List<StatusCount> countGroupByStatus();

    /**
     * 해당 상태에서 가장 오래 머문 행의 시각. 없으면 null 이다.
     *
     * <p>개수만으로는 부족하다 — MINTING 이 100건이어도 계속 흘러가는 중이면 정상이고,
     * 1건이어도 20분째 그대로면 사고다. <b>적체는 개수가 아니라 체류 시간으로 판단한다.</b>
     */
    @Query("select min(p.updatedAt) from NftPhotocard p where p.status = :status")
    LocalDateTime findOldestUpdatedAt(@Param("status") NftMintStatus status);

    interface StatusCount {
        NftMintStatus getStatus();

        long getCount();
    }
}
