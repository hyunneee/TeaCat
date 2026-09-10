package com.teacat.server.ticket.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.nft.entity.NftTicket;
import com.teacat.server.nft.repository.NftTicketRepository;
import com.teacat.server.payment.entity.TicketOrder;
import com.teacat.server.payment.repository.TicketOrderRepository;
import com.teacat.server.ticket.dto.response.MyTicketResponse;
import com.teacat.server.ticket.entity.Ticket;
import com.teacat.server.ticket.exception.TicketErrorCode;
import com.teacat.server.ticket.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 내 티켓 조회.
 *
 * <p>발행 상태는 {@code nft_tickets} 에 있어 함께 붙여 줍니다. <b>발행이 안 됐어도 예매는
 * 유효합니다</b> — 화면이 그 둘을 섞지 않도록 상태를 따로 내려 줍니다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TicketQueryService {

    /** 1인 1매 정책이라 목록이 길어질 일이 없다. 정책이 바뀌면 커서 페이징으로 옮긴다 */
    private static final Limit MAX_TICKETS = Limit.of(100);

    private final TicketRepository ticketRepository;
    private final TicketOrderRepository ticketOrderRepository;
    private final NftTicketRepository nftTicketRepository;
    private final FileStorageService fileStorageService;

    public List<MyTicketResponse> getMyTickets(Long userId) {
        List<Ticket> tickets = ticketRepository.findMyTickets(userId, MAX_TICKETS);
        if (tickets.isEmpty()) {
            return List.of();
        }

        List<Long> ticketIds = tickets.stream().map(Ticket::getId).toList();

        // 티켓마다 따로 조회하면 N+1 이 된다. 한 번에 읽어 붙인다
        Map<Long, NftTicket> nftByTicketId = new HashMap<>();
        nftTicketRepository.findByTicketIdIn(ticketIds)
                .forEach(nft -> nftByTicketId.put(nft.getTicket().getId(), nft));

        Map<Long, Long> orderIdByTicketId = new HashMap<>();
        ticketOrderRepository.findByTicketIdIn(ticketIds)
                .forEach(order -> orderIdByTicketId.put(order.getTicket().getId(), order.getId()));

        return tickets.stream()
                .map(ticket -> MyTicketResponse.of(
                        ticket,
                        orderIdByTicketId.get(ticket.getId()),
                        nftByTicketId.get(ticket.getId()),
                        posterUrl(ticket)))
                .toList();
    }

    public MyTicketResponse getMyTicket(Long userId, Long ticketId) {
        Ticket ticket = ticketRepository.findDetailById(ticketId)
                .orElseThrow(() -> new BusinessException(TicketErrorCode.TICKET_NOT_FOUND));

        if (!ticket.isOwnedBy(userId)) {
            throw new BusinessException(TicketErrorCode.TICKET_NOT_OWNED);
        }

        return MyTicketResponse.of(
                ticket,
                ticketOrderRepository.findByTicketId(ticketId).map(TicketOrder::getId).orElse(null),
                nftTicketRepository.findByTicketId(ticketId).orElse(null),
                posterUrl(ticket));
    }

    /** 포스터가 없는 공연도 있다. 그때는 URL 을 만들지 않는다 */
    private String posterUrl(Ticket ticket) {
        String key = ticket.getPerformanceDetail().getPerformance().getPosterImageKey();
        return key == null ? null : fileStorageService.presignedUrl(key);
    }
}
