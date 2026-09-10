package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftMintStatus;
import com.teacat.server.nft.entity.NftTicket;
import com.teacat.server.ticket.entity.TicketStatus;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NftTicketRepository extends JpaRepository<NftTicket, Long> {

    Optional<NftTicket> findByTicketId(Long ticketId);

    /** 티켓 목록에 발행 상태를 붙일 때. 티켓마다 따로 조회하면 N+1 이 된다 */
    List<NftTicket> findByTicketIdIn(java.util.Collection<Long> ticketIds);

    /** 발행 결과를 되짚을 때 쓴다 (블록체인 쪽 GET /internal/tickets/by-key 와 같은 키) */
    Optional<NftTicket> findByTicketKey(UUID ticketKey);

    /**
     * 발행 요청이 아직 나가지 않은 건.
     *
     * <p>mint_tx_hash 는 블록체인 서비스가 전송 직후에 남긴다. 비어 있다는 것은 요청이
     * 실패했거나 그 사이 우리가 죽었다는 뜻이다. 방금 만든 행은 저쪽이 아직 기록하기 전일 수
     * 있으므로 시간이 좀 지난 것만 본다.
     */
    List<NftTicket> findByStatusAndMintTxHashIsNullAndCreatedAtBeforeOrderByIdAsc(
            NftMintStatus status, LocalDateTime createdBefore, Limit limit);

    /**
     * 예매는 취소됐는데 아직 소각되지 않은 것.
     *
     * <p>발행이 확정된(MINTED) 것만 태울 수 있다. 티켓 상태는 tickets 가 갖고 있어 조인한다.
     */
    @Query("""
            SELECT n.ticket.id FROM NftTicket n
            WHERE n.ticket.status = :ticketStatus
              AND n.status = :mintStatus
              AND n.burnTxHash IS NULL
            ORDER BY n.id
            """)
    List<Long> findBurnable(@Param("ticketStatus") TicketStatus ticketStatus,
            @Param("mintStatus") NftMintStatus mintStatus, Limit limit);

    /**
     * 예매는 취소됐는데 아직 소각되지 않은 것.
     *
     * <p>enum 은 파라미터로 넘긴다. JPQL 리터럴로 쓰면 Hibernate 가 자바 클래스명으로 캐스팅을
     * 만들어 Postgres 의 실제 타입명과 어긋난다.
     */
    default List<Long> findCanceledButNotBurned(Limit limit) {
        return findBurnable(TicketStatus.CANCELLED, NftMintStatus.MINTED, limit);
    }

    /**
     * 소각됨으로 표시한다.
     *
     * <p>엔티티가 아니라 UPDATE 로 쓴다. {@code status} 는 블록체인 서비스가 발행 흐름에서
     * 쓰는 컬럼이라 엔티티에서 {@code updatable = false} 로 막아 뒀는데, 그 보호를 풀지 않고
     * 이 전이만 하기 위해서다.
     *
     * <p>{@code MINTED} 인 행만 바꾼다 — 발행이 아직 확정되지 않은 것을 소각으로 덮으면
     * 그쪽 상태 기계와 어긋난다.
     *
     * @return 1 이면 표시됨, 0 이면 이미 BURNED 이거나 아직 MINTED 가 아니다
     */
    @Transactional
    @Modifying(flushAutomatically = true)
    @Query("""
            UPDATE NftTicket n
               SET n.status = :burned, n.updatedAt = :now
             WHERE n.ticket.id = :ticketId
               AND n.status = :minted
            """)
    int markBurned(@Param("ticketId") Long ticketId,
            @Param("minted") NftMintStatus minted,
            @Param("burned") NftMintStatus burned,
            @Param("now") LocalDateTime now);

    /** 소각됨으로 표시한다. enum 은 파라미터로 넘긴다 (JPQL 리터럴은 타입 캐스팅이 어긋난다) */
    default int markBurned(Long ticketId) {
        return markBurned(ticketId, NftMintStatus.MINTED, NftMintStatus.BURNED, LocalDateTime.now());
    }

    /** 상태별 티켓 수. 포토카드와 같은 파이프라인 지표다 (NftChainPipelineMetrics) */
    @Query("select t.status as status, count(t) as count from NftTicket t group by t.status")
    List<StatusCount> countGroupByStatus();

    /** 해당 상태에서 가장 오래 머문 행의 시각. 없으면 null */
    @Query("select min(t.updatedAt) from NftTicket t where t.status = :status")
    LocalDateTime findOldestUpdatedAt(@Param("status") NftMintStatus status);

    interface StatusCount {
        NftMintStatus getStatus();

        long getCount();
    }
}
