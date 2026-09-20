package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftTradeReview;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface NftTradeReviewRepository extends JpaRepository<NftTradeReview, Long> {

    Optional<NftTradeReview> findByTradeId(Long tradeId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from NftTradeReview r where r.id = :reviewId")
    Optional<NftTradeReview> findByIdForUpdate(@Param("reviewId") Long reviewId);

    /** 관리자 큐 — 결정 안 난 것, 오래된 순 */
    Page<NftTradeReview> findByDecisionIsNullOrderByCreatedAtAsc(Pageable pageable);

    /** 결정 난 것, 최근 결정 순 */
    Page<NftTradeReview> findByDecisionIsNotNullOrderByDecidedAtDesc(Pageable pageable);

    long countByDecisionIsNull();

    /** 시한 자동 승인 대상 — 정산을 실제로 멈춘(held) 심사 중 결정 없이 이 시각보다 먼저 열린 것. 표시만 된 심사는 시한이 없다 */
    @Query("""
            select r.id from NftTradeReview r
             where r.decision is null and r.held = true and r.createdAt < :before
             order by r.createdAt asc
            """)
    List<Long> findOpenIdsCreatedBefore(@Param("before") LocalDateTime before, Pageable pageable);

    /** 이 계정이 판매자 또는 구매자로 심사에 등장한 횟수 (관리자가 반복 등장을 보기 위해) */
    @Query("""
            select count(r) from NftTradeReview r
             where (r.trade.seller.id = :userId or r.trade.buyer.id = :userId)
               and r.createdAt >= :since
            """)
    long countAppearances(@Param("userId") Long userId, @Param("since") LocalDateTime since);
}
