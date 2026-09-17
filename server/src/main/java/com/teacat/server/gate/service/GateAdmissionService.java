package com.teacat.server.gate.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.gate.entity.Admission;
import com.teacat.server.gate.entity.AdmissionMethod;
import com.teacat.server.gate.exception.GateErrorCode;
import com.teacat.server.gate.repository.AdmissionRepository;
import com.teacat.server.gate.repository.GateTicketRepository;
import com.teacat.server.ticket.exception.TicketErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 입장 기록을 만들고 되돌린다.
 *
 * <p>🔴 <b>클래스에 {@code @Transactional} 을 붙이지 않았다. 일부러다.</b>
 * 중복 입장은 DB 의 {@code uq_admissions_ticket} 이 막고, 그 위반을 읽기 좋은 에러로
 * 바꾸려면 예외를 <b>잡아야</b> 한다. 그런데 트랜잭션 <b>안에서</b> 잡으면 그 트랜잭션은 이미
 * rollback-only 로 표시돼 있어서, 잡고 나서 정상 응답을 만들어도 커밋 시점에
 * {@code UnexpectedRollbackException} 으로 터진다.
 *
 * <p>그래서 저장은 {@code saveAndFlush} 가 <b>자기 트랜잭션에서</b> 하게 두고
 * (SimpleJpaRepository 가 {@code @Transactional} 이다), 이 메서드는 그 바깥에서 잡는다.
 */
@Service
@RequiredArgsConstructor
public class GateAdmissionService {

    private final AdmissionRepository admissionRepository;
    private final GateTicketRepository gateTicketRepository;

    /**
     * 들여보낸다.
     *
     * @param adminId 통과시킨 운영자. 수동 통과의 책임 소재다
     * @throws BusinessException 없는 티켓 · 취소된 예매 · 이미 입장한 티켓
     */
    public Admission admit(Long ticketId, Long adminId, AdmissionMethod method) {
        boolean admittable = gateTicketRepository.isAdmittable(ticketId)
                .orElseThrow(() -> new BusinessException(TicketErrorCode.TICKET_NOT_FOUND));

        if (!admittable) {
            throw new BusinessException(GateErrorCode.TICKET_NOT_ADMITTABLE);
        }

        /* 먼저 읽어 보는 건 **친절** 이지 보장이 아니다. 이 확인과 아래 저장 사이에 다른
           게이트가 끼어들 수 있다 — 입구에 기기가 두 대면 실제로 일어난다. */
        if (admissionRepository.existsByTicketId(ticketId)) {
            throw new BusinessException(GateErrorCode.ALREADY_ADMITTED);
        }

        try {
            return admissionRepository.saveAndFlush(Admission.of(ticketId, adminId, method));
        } catch (DataIntegrityViolationException e) {
            /* 🔴 경쟁 상태를 DB 제약이 잡은 자리다. 위 existsBy 가 통과했는데 여기로 왔다면
               같은 티켓이 동시에 두 번 들어온 것이다. 사용자에게는 같은 답을 준다.
               ⚠️ 예외를 로그로 넘기지 않는다 — 이 흐름의 요청 바디에는 생체 특징값이 있고,
                  ERROR 로그는 Sentry 로 나간다 (server/CLAUDE.md 9장). */
            throw new BusinessException(GateErrorCode.ALREADY_ADMITTED);
        }
    }

    /**
     * 입장을 되돌린다.
     *
     * <p>되돌릴 수 없는 동작이 아니라 <b>잘못을 되돌리는</b> 동작이다. 이게 없으면 오인 입장
     * 한 건에 진짜 관객이 영구히 막힌다 — 후보 검색이 이미 입장한 티켓을 빼기 때문이다.
     */
    @Transactional
    public void cancel(Long ticketId) {
        Admission admission = admissionRepository.findByTicketId(ticketId)
                .orElseThrow(() -> new BusinessException(GateErrorCode.ADMISSION_NOT_FOUND));

        admissionRepository.delete(admission);
    }
}
