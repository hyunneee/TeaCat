package com.teacat.server.ticket.service;

import com.teacat.server.nft.entity.NftMintStatus;
import com.teacat.server.nft.entity.NftTicket;
import com.teacat.server.nft.repository.NftTicketRepository;
import com.teacat.server.ticket.client.BlockchainTicketClient;
import com.teacat.server.ticket.client.TicketIssueResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * 예매 취소에 따른 NFT 티켓(SBT) 소각.
 *
 * <p>발행과 같은 규칙입니다 — 실패해도 예외를 밖으로 내보내지 않고 재시도에 맡깁니다.
 * 이미 소각된 티켓이면 새 트랜잭션 없이 {@code ALREADY_DONE} 이라 두 번 태우지 않습니다.
 *
 * <p>확정 결과({@code burn_tx_hash})는 블록체인 서비스가 직접 씁니다. 우리는 보내기만 합니다.
 *
 * <p><b>소각이 안 돼도 예매 취소와 환불은 유효합니다.</b> 체인에 남은 SBT 는 우리 DB 에서
 * 이미 취소된 티켓이라 입장 판정에 쓰이지 않습니다 — 다만 온체인 상태가 어긋나므로 배치가
 * 끝까지 따라갑니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TicketBurnService {

    private final NftTicketRepository nftTicketRepository;
    private final BlockchainTicketClient blockchainTicketClient;

    /** 소각을 요청한다. 태울 것이 없으면 아무것도 하지 않는다 */
    public void requestBurn(Long ticketId) {
        Optional<String> tokenId;
        try {
            tokenId = findBurnableTokenId(ticketId);
        } catch (RuntimeException e) {
            log.error("소각 대상을 확인하지 못했습니다. ticketId={}", ticketId, e);
            return;
        }
        if (tokenId.isEmpty()) {
            return;
        }

        try {
            TicketIssueResult result = blockchainTicketClient.burn(tokenId.get());

            // 보냈으면(PENDING) 블록체인 서비스가 응답 전에 burn_tx_hash 를 이미 남겼고,
            // 이미 태워져 있었으면(ALREADY_DONE) 체인 상태가 그렇다. 둘 다 소각으로 본다
            markBurned(ticketId);

            log.info("NFT 티켓 소각 요청 ticketId={} tokenId={} status={}",
                    ticketId, tokenId.get(), result.status());
        } catch (RuntimeException e) {
            log.error("NFT 티켓 소각을 요청하지 못했습니다. 재시도 대상입니다. ticketId={}", ticketId, e);
        }
    }

    /**
     * 소각됨으로 표시한다.
     *
     * <p>트랜잭션은 리포지토리 메서드가 갖는다 — 여기서 {@code @Transactional} 을 붙여도
     * 같은 클래스 안에서 부르면 프록시를 거치지 않아 적용되지 않는다.
     *
     * <p>표시에 실패해도 소각 자체는 이미 나갔다. 다음 재시도가 같은 티켓을 다시 잡아
     * {@code ALREADY_DONE} 을 받고 여기까지 온다.
     */
    private void markBurned(Long ticketId) {
        nftTicketRepository.markBurned(ticketId);
    }

    /**
     * 소각할 수 있는 토큰 번호.
     *
     * <p>체인에 올라간(MINTED) 것만 태울 수 있다. 발행이 아직 확정되지 않았으면 태울 대상이
     * 없으므로 건너뛴다 — 그 발행이 확정된 뒤에 배치가 다시 잡는다.
     */
    @Transactional(readOnly = true)
    public Optional<String> findBurnableTokenId(Long ticketId) {
        return nftTicketRepository.findByTicketId(ticketId)
                .filter(nft -> nft.getStatus() == NftMintStatus.MINTED)
                .filter(nft -> nft.getBurnTxHash() == null)
                .map(NftTicket::getTokenId)
                .map(String::valueOf);
    }

    /**
     * 취소됐는데 아직 소각되지 않은 티켓.
     *
     * <p>예매가 취소됐고, 발행은 확정됐고(MINTED), 소각 트랜잭션은 없는 것들이다.
     */
    @Transactional(readOnly = true)
    public List<Long> findUnburned(Limit limit) {
        return nftTicketRepository.findCanceledButNotBurned(limit);
    }
}
