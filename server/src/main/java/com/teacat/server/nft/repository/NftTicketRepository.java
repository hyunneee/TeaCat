package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftMintStatus;
import com.teacat.server.nft.entity.NftTicket;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NftTicketRepository extends JpaRepository<NftTicket, Long> {

    Optional<NftTicket> findByTicketId(Long ticketId);

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
}
