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

    /* 2026-09-11: existsByDesignPerformanceIdAndTicketIdIsNotNull 로 대체했다. 뽑기 풀 도안이 그
       공연에 묶일 수 있게 되면서, 뽑힌 카드(ticket_id NULL)도 이 조회에 잡혀 그 공연 팩을 한 번만
       열어도 수동 일괄 발급이 영구히 막혔다(C4). 호출부가 하나뿐이라 지우지 않고 주석으로 남긴다.
    boolean existsByDesignPerformanceId(Long performanceId);
    */

    /** 그 공연에 <b>티켓으로</b> 발급된 포토카드가 있는가. 뽑힌 카드(ticket_id NULL)는 세지 않는다 */
    boolean existsByDesignPerformanceIdAndTicketIdIsNotNull(Long performanceId);

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
