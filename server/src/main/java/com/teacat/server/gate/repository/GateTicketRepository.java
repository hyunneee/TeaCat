package com.teacat.server.gate.repository;

import com.teacat.server.ticket.entity.Ticket;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * 게이트가 티켓을 보는 창구. <b>전부 네이티브 쿼리다.</b>
 *
 * <p>🔴 <b>저장해 둔 임베딩을 JVM 으로 꺼내지 않는다.</b> {@code Face.cosineSimilarityTo} 는
 * 1:1 전용이고, 1:N 에 쓰면 회차 티켓 전부를 엔티티로 읽어야 한다 — 그건 그 메서드가
 * 존재하는 이유("생체 특징값이 서비스·DTO·로그로 번질 길을 만들지 않는다")를 정면으로 깬다.
 * 계산은 pgvector 가 DB 안에서 하고, 나가는 것은 <b>id 와 점수뿐</b>이다.
 */
public interface GateTicketRepository extends Repository<Ticket, Long> {

    /**
     * 이 회차에서 찍힌 얼굴과 가장 가까운 티켓 <b>둘</b>.
     *
     * <p><b>왜 둘인가.</b> 1등만 보면 "0.71 과 0.70 이 나란히 있는" 상황을 통과시킨다 —
     * 둘 중 누구인지 모르는 상태인데 1등을 들여보내는 셈이다. 2등과의 간격(마진)이
     * 좁으면 사람이 봐야 한다({@code GateDecision.REVIEW}). 3등부터는 판정에 쓰이지 않으므로
     * 읽지 않는다.
     *
     * <p><b>거르는 조건이 곧 안전장치다.</b>
     * <ul>
     *   <li>{@code performance_detail_id} — 게이트 기기가 다른 회차 티켓을 훑지 못하게 한다</li>
     *   <li>{@code status = 'CONFIRMED'} — 취소된 예매는 후보가 아니다</li>
     *   <li>{@code face_model_version = :modelVersion} — 모델이 다르면 좌표계가 달라 비교가
     *       성립하지 않는다. 이 한 줄이 기본 얼굴({@code bootstrap-default}) 티켓을 통째로
     *       빼낸다 (GATE_PLAN.md 2-2)</li>
     *   <li>{@code NOT EXISTS (admissions)} — 이미 들어간 사람을 빼지 않으면 그 사람이 계속
     *       1등으로 잡혀, 뒤에 온 진짜 관객이 "이미 입장함" 으로 막힌다</li>
     * </ul>
     *
     * <p>{@code <=>} 는 코사인 <b>거리</b>다. 유사도 = {@code 1 - 거리}. 양쪽 다 L2 정규화된
     * 벡터라 성립한다.
     *
     * <p>{@code COUNT(*) OVER ()} 는 LIMIT 이전에 계산되므로 <b>후보 전체 수</b>가 나온다.
     * 회차에 대조 가능한 티켓이 0장이면 결과가 비고, 화면이 그 사실을 말할 수 있다.
     * 따로 세는 쿼리를 한 번 더 날리지 않기 위한 것이다 — 여긴 사람이 줄 서서 기다리는 경로다.
     *
     * @param probe 벡터 리터럴 문자열({@code "[0.1,-0.2,…]"}). pgvector 가 텍스트에서 캐스팅한다.
     *              🔴 이 값은 <b>생체 특징값이다.</b> 로그·예외 메시지에 싣지 마세요 (GATE_PLAN.md 4-4)
     */
    @Query(value = """
            SELECT t.id                                              AS ticketId,
                   1 - (t.face_embedding <=> CAST(:probe AS vector))  AS similarity,
                   COUNT(*) OVER ()                                   AS candidateCount
              FROM tickets t
             WHERE t.performance_detail_id = :performanceDetailId
               AND t.status                = 'CONFIRMED'
               AND t.face_embedding      IS NOT NULL
               AND t.face_model_version   = :modelVersion
               AND NOT EXISTS (SELECT 1 FROM admissions a WHERE a.ticket_id = t.id)
             ORDER BY t.face_embedding <=> CAST(:probe AS vector)
             LIMIT 2
            """, nativeQuery = true)
    List<CandidateProjection> findTopCandidates(
            @Param("performanceDetailId") Long performanceDetailId,
            @Param("probe") String probe,
            @Param("modelVersion") String modelVersion);

    /**
     * 판정이 붙은 티켓을 운영자에게 보여줄 만큼만 읽는다.
     *
     * <p>엔티티 대신 프로젝션인 이유는 지연 로딩 경계를 만들지 않기 위해서다 —
     * {@code Ticket.user} 는 LAZY 라 트랜잭션 밖에서 이름을 꺼내면 터진다. 필요한 다섯 칸만 읽는다.
     */
    @Query(value = """
            SELECT t.id          AS ticketId,
                   u.name        AS userName,
                   a.area_code   AS areaCode,
                   s.row_label   AS rowLabel,
                   s.seat_number AS seatNumber
              FROM tickets t
              JOIN users u ON u.id = t.user_id
              JOIN areas a ON a.id = t.area_id
              LEFT JOIN seats s ON s.id = t.seat_id
             WHERE t.id = :ticketId
            """, nativeQuery = true)
    Optional<TicketSummaryProjection> findSummary(@Param("ticketId") Long ticketId);

    /**
     * 회차의 검표 현황. 게이트 화면이 들어오자마자 한 번 부른다.
     *
     * <p>🔴 {@code faceEnrolledTickets} 가 <b>0 이면 이 회차는 얼굴 검표를 쓸 수 없다.</b>
     * 지금 발권된 티켓은 전부 기본 얼굴이라 실제로 0 이 나온다(GATE_PLAN.md 2-2). 이 값을
     * 안 보여주면 운영자가 카메라를 켜고 한참 찍다가 전부 거절당한 뒤에야 알게 된다.
     */
    @Query(value = """
            SELECT COUNT(*)                                          AS totalTickets,
                   COUNT(*) FILTER (
                       WHERE t.face_embedding    IS NOT NULL
                         AND t.face_model_version <> :defaultModelVersion)
                                                                     AS faceEnrolledTickets,
                   COUNT(a.ticket_id)                                AS admittedCount
              FROM tickets t
              LEFT JOIN admissions a ON a.ticket_id = t.id
             WHERE t.performance_detail_id = :performanceDetailId
               AND t.status = 'CONFIRMED'
            """, nativeQuery = true)
    GateCountsProjection countFor(@Param("performanceDetailId") Long performanceDetailId,
            @Param("defaultModelVersion") String defaultModelVersion);

    /** 티켓이 존재하며 취소되지 않았는가 (수동 통과에서 본다) */
    @Query(value = """
            SELECT t.status = 'CONFIRMED'
              FROM tickets t
             WHERE t.id = :ticketId
            """, nativeQuery = true)
    Optional<Boolean> isAdmittable(@Param("ticketId") Long ticketId);

    /** 후보 한 줄 — id 와 점수, 그리고 후보가 몇이었는지 */
    interface CandidateProjection {
        Long getTicketId();

        double getSimilarity();

        long getCandidateCount();
    }

    /** 화면에 보여줄 티켓 요약 */
    interface TicketSummaryProjection {
        Long getTicketId();

        String getUserName();

        String getAreaCode();

        /** 스탠딩이면 null */
        String getRowLabel();

        /** 스탠딩이면 null */
        Integer getSeatNumber();
    }

    /** 회차 검표 현황 */
    interface GateCountsProjection {
        long getTotalTickets();

        long getFaceEnrolledTickets();

        long getAdmittedCount();
    }
}
