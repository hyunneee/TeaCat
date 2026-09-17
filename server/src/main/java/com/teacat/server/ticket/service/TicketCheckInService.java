package com.teacat.server.ticket.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.ticket.dto.request.CheckInScanRequest;
import com.teacat.server.ticket.dto.request.CheckInVerifyRequest;
import com.teacat.server.ticket.dto.response.CheckInResultResponse;
import com.teacat.server.ticket.dto.response.CheckInTicketResponse;
import com.teacat.server.ticket.entity.Ticket;
import com.teacat.server.ticket.exception.TicketErrorCode;
import com.teacat.server.ticket.repository.TicketRepository;
import com.teacat.server.user.entity.Face;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 게이트 입장 확인 (검표).
 *
 * <h3>두 단계로 나눈 이유</h3>
 * QR 을 찍으면 먼저 <b>표가 맞는지</b> 보여주고({@link #scan}), 사람이 확인한 뒤에 얼굴을
 * 찍는다({@link #verify}). 한 번에 처리하면 회차가 틀렸거나 이미 입장한 표인데도 얼굴부터
 * 찍게 되고, 줄이 밀린다.
 *
 * <h3>🔴 검사 순서가 곧 정책이다</h3>
 * 얼굴은 <b>마지막</b>이다. 취소된 표·다른 회차·이미 입장한 표는 얼굴을 보기 전에 끊는다 —
 * 그래야 통과할 수 없는 사람의 생체정보를 굳이 받지 않는다.
 */
@Service
@RequiredArgsConstructor
public class TicketCheckInService {

    private final TicketRepository ticketRepository;
    private final TicketQrSigner qrSigner;

    /** QR 을 찍은 직후 — 이 표가 이 회차의 것인지 확인하고 보여준다 */
    @Transactional(readOnly = true)
    public CheckInTicketResponse scan(CheckInScanRequest request) {
        Ticket ticket = findTicket(request.qrToken(), request.ticketId());
        ensureUsableAt(ticket, request.performanceDetailId());
        return CheckInTicketResponse.from(ticket);
    }

    /**
     * 얼굴을 대조하고, 같은 사람이면 입장 처리한다.
     *
     * <p>🔴 <b>닮지 않았으면 입장 기록을 남기지 않는다.</b> 남기면 본인이 다시 찍을 때
     * "이미 입장함" 으로 막힌다 — 한 번 실패한 사람이 영영 못 들어가는 셈이다.
     */
    @Transactional
    public CheckInResultResponse verify(CheckInVerifyRequest request) {
        Ticket ticket = findTicket(request.qrToken(), request.ticketId());
        ensureUsableAt(ticket, request.performanceDetailId());

        if (!ticket.canVerifyFace()) {
            throw new BusinessException(TicketErrorCode.TICKET_FACE_UNAVAILABLE);
        }
        /* 모델이 다르면 좌표계가 달라 대조 자체가 성립하지 않는다.
           "확인할 수 없음" 으로 끝내지, 낮은 점수로 떨어뜨리지 않는다 — 그건 거짓말이다. */
        if (!ticket.isSameFaceModel(request.modelVersion())) {
            throw new BusinessException(TicketErrorCode.TICKET_FACE_MODEL_MISMATCH);
        }

        double similarity = ticket.faceSimilarityTo(request.embedding());
        boolean match = similarity >= Face.SAME_PERSON_THRESHOLD;

        if (match) {
            ticket.checkIn(LocalDateTime.now());
        }

        return CheckInResultResponse.of(
                similarity,
                Face.SAME_PERSON_THRESHOLD,
                match ? ticket.getCheckedInAt() : null,
                CheckInTicketResponse.from(ticket));
    }

    /**
     * QR 이거나 손으로 넣은 번호. 둘 중 하나만 온다.
     *
     * <p>🔴 QR 이 위조됐을 때와 없는 티켓일 때 <b>같은 오류를 낸다.</b> 구분해서 알려주면
     * 번호를 하나씩 넣어보며 존재하는 티켓을 찾아낼 수 있다.
     */
    private Ticket findTicket(String qrToken, Long ticketId) {
        Long id = (qrToken != null && !qrToken.isBlank()) ? qrSigner.verify(qrToken) : ticketId;
        if (id == null) {
            throw new BusinessException(TicketErrorCode.TICKET_QR_INVALID);
        }

        return ticketRepository.findDetailById(id)
                .orElseThrow(() -> new BusinessException(TicketErrorCode.TICKET_QR_INVALID));
    }

    /** 얼굴을 보기 전에 끊어야 하는 것들 — 순서가 그대로 화면의 안내 문구가 된다 */
    private void ensureUsableAt(Ticket ticket, Long performanceDetailId) {
        if (ticket.isCancelled()) {
            throw new BusinessException(TicketErrorCode.TICKET_CANCELLED);
        }
        if (!ticket.getPerformanceDetail().getId().equals(performanceDetailId)) {
            throw new BusinessException(TicketErrorCode.TICKET_WRONG_PERFORMANCE);
        }
        if (ticket.isCheckedIn()) {
            throw new BusinessException(TicketErrorCode.TICKET_ALREADY_CHECKED_IN);
        }
    }
}
