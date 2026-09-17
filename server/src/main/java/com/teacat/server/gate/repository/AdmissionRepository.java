package com.teacat.server.gate.repository;

import com.teacat.server.gate.entity.Admission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AdmissionRepository extends JpaRepository<Admission, Long> {

    Optional<Admission> findByTicketId(Long ticketId);

    /**
     * 이미 입장했는가.
     *
     * <p>⚠️ <b>이건 보장이 아니라 안내다.</b> 확인과 저장 사이에 다른 게이트가 끼어들 수 있다.
     * 중복을 실제로 막는 건 {@code uq_admissions_ticket} 이고, 이 메서드는 그 전에
     * 읽기 쉬운 에러를 만들어 주는 용도다 ({@code GateAdmissionService} 주석).
     */
    boolean existsByTicketId(Long ticketId);
}
