package com.teacat.server.ticket.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.entity.NftMintStatus;
import com.teacat.server.nft.entity.NftTicket;
import com.teacat.server.nft.repository.NftTicketRepository;
import com.teacat.server.ticket.entity.Ticket;
import com.teacat.server.ticket.exception.TicketErrorCode;
import com.teacat.server.ticket.repository.TicketRepository;
import com.teacat.server.wallet.client.BlockchainProperties;
import com.teacat.server.wallet.entity.Wallet;
import com.teacat.server.wallet.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * NFT 티켓의 <b>DB 기록만</b> 담당합니다. 한 메서드가 곧 한 트랜잭션입니다.
 *
 * <p>{@link TicketIssueService} 와 나눈 이유는 다른 도메인과 같습니다 — 체인 호출을 트랜잭션
 * 안에서 하지 않기 위해서입니다.
 */
@Service
@RequiredArgsConstructor
public class NftTicketRecorder {

    private final TicketRepository ticketRepository;
    private final NftTicketRepository nftTicketRepository;
    private final WalletService walletService;
    private final BlockchainProperties blockchainProperties;

    /**
     * 발행 대상 행을 확보한다. 없으면 만들고, 이미 요청이 나갔으면 비어 있는 값을 돌려준다.
     *
     * <p>이 트랜잭션이 <b>체인 호출보다 먼저 커밋</b>되는 것이 중요하다. 그래야 그 사이에
     * 죽어도 재시도 대상으로 남는다.
     */
    @Transactional
    public Optional<IssueTarget> prepare(Long ticketId) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new BusinessException(TicketErrorCode.TICKET_NOT_FOUND));

        // 취소된 예매는 발행하지 않는다
        if (ticket.isCancelled()) {
            return Optional.empty();
        }

        NftTicket nftTicket = nftTicketRepository.findByTicketId(ticketId).orElse(null);
        if (nftTicket != null && nftTicket.isIssueSent()) {
            return Optional.empty();
        }

        if (nftTicket == null) {
            Wallet wallet = walletService.resolveWallet(ticket.getUser().getId());
            nftTicket = nftTicketRepository.save(
                    NftTicket.pending(ticket, wallet, blockchainProperties.chainId()));
        }

        return Optional.of(new IssueTarget(
                nftTicket.getTicketKey(), nftTicket.getWallet().getAddress()));
    }

    /**
     * 아직 발행 요청이 나가지 않은 티켓.
     *
     * <p>{@code mint_tx_hash} 가 비어 있다는 것은 블록체인 서비스가 전송 기록을 남기지 못했다는
     * 뜻이다 — 요청 자체가 실패했거나 그 사이에 우리가 죽었다.
     */
    @Transactional(readOnly = true)
    public List<Long> findUnissued(LocalDateTime createdBefore, Limit limit) {
        return nftTicketRepository
                .findByStatusAndMintTxHashIsNullAndCreatedAtBeforeOrderByIdAsc(
                        NftMintStatus.PENDING, createdBefore, limit)
                .stream()
                .map(nftTicket -> nftTicket.getTicket().getId())
                .toList();
    }

    public record IssueTarget(UUID ticketKey, String address) {
    }
}
