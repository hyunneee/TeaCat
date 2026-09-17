package com.teacat.server.gate.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * 입장 기록 — 이 티켓으로 누가 언제 들어갔는가.
 *
 * <p>티켓 한 장에 최대 한 행이다. 그 보장은 DB 의 {@code uq_admissions_ticket} 이 한다
 * (마이그레이션 {@code V20260916_1000} 주석).
 *
 * <p>🔴 <b>유사도 점수를 담지 않는다.</b> 생체 판정 점수라 보관할 값이 아니다. 남기는 건
 * 누가 · 언제 · 어떤 방식인가뿐이고, 그건 오인 입장을 되짚을 때 필요한 최소한이다.
 *
 * <p><b>티켓과 운영자를 연관이 아니라 id 로 들고 있다.</b> {@code @ManyToOne} 으로 매핑하면
 * 입장을 만들 때 Ticket 엔티티를 영속 상태로 들고 있어야 하고, 게이트는 그걸 필요로 하지
 * 않는다 — 후보 검색이 돌려주는 건 id 와 점수뿐이고, 화면에 보여줄 좌석·이름은 별도
 * 프로젝션으로 읽는다. 엔티티를 끌고 다니면 지연 로딩 경계가 늘어날 뿐이다.
 * 참조 무결성은 그대로 DB 의 외래키가 지킨다.
 */
@Entity
@Table(name = "admissions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Admission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_id", nullable = false, updatable = false)
    private Long ticketId;

    @CreationTimestamp
    @Column(name = "admitted_at", nullable = false, updatable = false)
    private LocalDateTime admittedAt;

    /** 통과시킨 운영자. MANUAL 의 책임 소재다 */
    @Column(name = "admitted_by", nullable = false, updatable = false)
    private Long admittedBy;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "method", nullable = false, updatable = false,
            columnDefinition = "admission_method")
    private AdmissionMethod method;

    private Admission(Long ticketId, Long admittedBy, AdmissionMethod method) {
        this.ticketId = ticketId;
        this.admittedBy = admittedBy;
        this.method = method;
    }

    public static Admission of(Long ticketId, Long admittedBy, AdmissionMethod method) {
        return new Admission(ticketId, admittedBy, method);
    }
}
