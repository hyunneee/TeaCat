package com.teacat.server.gate.service;

import com.teacat.server.common.config.GateProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.gate.dto.request.GateVerifyRequest;
import com.teacat.server.gate.dto.response.GateSessionResponse;
import com.teacat.server.gate.dto.response.GateTicketResponse;
import com.teacat.server.gate.dto.response.GateVerifyResponse;
import com.teacat.server.gate.entity.Admission;
import com.teacat.server.gate.entity.AdmissionMethod;
import com.teacat.server.gate.exception.GateErrorCode;
import com.teacat.server.gate.repository.GateTicketRepository;
import com.teacat.server.gate.repository.GateTicketRepository.CandidateProjection;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.ticket.exception.TicketErrorCode;
import com.teacat.server.user.entity.Face;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 현장 검표 — 찍힌 얼굴이 이 회차의 누구인지 찾는다 (1:N).
 *
 * <p><b>본인확인({@code UserService.verifyFace})과 다른 일이다.</b> 저쪽은 관객 본인 토큰으로
 * 자기 프로필 얼굴과 1:1 로 맞춰 보고 점수만 돌려준다. 여기는 운영자 토큰으로 이 회차 티켓
 * 전체를 훑어 <b>누구인지</b> 답하고, 맞으면 <b>입장까지 처리한다.</b>
 *
 * <p>🔴 <b>클래스에 {@code @Transactional} 을 붙이지 않았다.</b> {@link #verify} 가
 * {@link GateAdmissionService#admit} 을 부르는데, 그쪽은 중복 입장 위반을 <b>트랜잭션 밖에서</b>
 * 잡아야 한다 (그 클래스 주석). 여기에 트랜잭션을 걸면 admit 이 그 트랜잭션에 합류해
 * 잡아도 rollback-only 가 남는다. 읽기 전용인 {@link #getSession} 만 따로 건다.
 */
@Service
@RequiredArgsConstructor
public class GateVerifyService {

    private final GateTicketRepository gateTicketRepository;
    private final PerformanceDetailRepository performanceDetailRepository;
    private final GateAdmissionService gateAdmissionService;
    private final GateProperties gateProperties;

    /** 이 회차를 얼굴로 검표할 수 있는가 — 화면이 카메라를 켜기 전에 묻는다 */
    @Transactional(readOnly = true)
    public GateSessionResponse getSession(Long performanceDetailId) {
        PerformanceDetail detail = performanceDetailRepository
                .findWithPerformanceById(performanceDetailId)
                .orElseThrow(() -> new BusinessException(PerformanceErrorCode.SCHEDULE_NOT_FOUND));

        return GateSessionResponse.of(detail,
                gateTicketRepository.countFor(performanceDetailId, Face.DEFAULT_MODEL_VERSION));
    }

    /**
     * 찍힌 얼굴로 티켓을 찾고, 확실하면 들여보낸다.
     *
     * <p>여러 장을 받아 <b>가장 높은 점수</b>를 쓴다(best-of-N). 한 프레임이 흔들려도 다른
     * 프레임이 통과시키므로, 얼굴이 움직여 벡터가 흩어지는 만큼을 여기서 흡수한다.
     */
    public GateVerifyResponse verify(Long adminId, Long performanceDetailId,
            GateVerifyRequest request) {

        /* 🔴 기본 얼굴의 모델 버전으로는 대조하지 않는다. 그 값은 모든 계정이 공유하는
           균일 벡터라, 함께 보내면 아직 실제 얼굴을 등록하지 않은 티켓 전부와 유사도 1.0 으로
           붙는다 — 그 자체가 만능 열쇠다 (GateErrorCode.FACE_MODEL_NOT_ALLOWED). */
        if (Face.DEFAULT_MODEL_VERSION.equals(request.modelVersion())) {
            throw new BusinessException(GateErrorCode.FACE_MODEL_NOT_ALLOWED);
        }

        // DB 를 부르기 전에 전부 검사한다. 절반 대조하고 나서 거절하면 그 절반이 낭비다
        request.embeddings().forEach(GateVerifyService::validateProbe);

        Candidate best = findBest(performanceDetailId, request);
        if (best == null) {
            return GateVerifyResponse.noCandidates();
        }

        GateProperties.Threshold threshold = gateProperties.threshold();

        if (best.similarity() < threshold.review()) {
            /* 🔴 가장 가까웠던 티켓이 누구였는지는 돌려주지 않는다. 남의 얼굴로 여러 번 찍으며
               그 회차에 누가 오는지 훑어볼 수 있게 된다. */
            return GateVerifyResponse.noMatch(best.candidateCount());
        }

        GateTicketResponse ticket = gateTicketRepository.findSummary(best.ticketId())
                .map(GateTicketResponse::from)
                .orElseThrow(() -> new BusinessException(TicketErrorCode.TICKET_NOT_FOUND));

        if (best.similarity() >= threshold.match() && best.margin() >= threshold.margin()) {
            Admission admission =
                    gateAdmissionService.admit(best.ticketId(), adminId, AdmissionMethod.FACE);
            return GateVerifyResponse.match(best.candidateCount(), ticket,
                    admission.getAdmittedAt(), best.similarity(), best.runnerUp());
        }

        /* 점수는 충분한데 2등과 붙어 있는 경우도 여기로 온다 — 누구인지 모르는 상태라
           1등을 그냥 통과시킬 수 없다. 사람이 본다. */
        return GateVerifyResponse.review(best.candidateCount(), ticket,
                best.similarity(), best.runnerUp());
    }

    /**
     * 보낸 프레임들을 각각 대조해 가장 좋은 한 건을 고른다.
     *
     * <p>2등은 <b>이긴 프레임의 2등</b>이다. 프레임마다 후보 순위가 다를 수 있으므로,
     * 마진은 반드시 같은 프레임 안에서 재야 의미가 있다.
     *
     * @return 후보가 하나도 없었으면 null
     */
    private Candidate findBest(Long performanceDetailId, GateVerifyRequest request) {
        Candidate best = null;

        for (float[] probe : request.embeddings()) {
            List<CandidateProjection> rows = gateTicketRepository.findTopCandidates(
                    performanceDetailId, toVectorLiteral(probe), request.modelVersion());

            if (rows.isEmpty()) {
                continue;
            }

            CandidateProjection top = rows.getFirst();

            /* 🔴 길이 0 인 벡터가 저장돼 있으면 코사인 거리가 NaN 이 된다. NaN 은 어떤 비교에도
               false 라, 걸러내지 않으면 아래 임계값 검사(`similarity < review`)를 그냥
               통과해 버린다 — "판단할 수 없음" 이 "통과" 로 둔갑한다. */
            if (!Double.isFinite(top.getSimilarity())) {
                continue;
            }

            if (best == null || top.getSimilarity() > best.similarity()) {
                Double runnerUp = rows.size() > 1 && Double.isFinite(rows.get(1).getSimilarity())
                        ? rows.get(1).getSimilarity()
                        : null;
                best = new Candidate(top.getTicketId(), top.getSimilarity(), runnerUp,
                        top.getCandidateCount());
            }
        }

        return best;
    }

    private static void validateProbe(float[] probe) {
        if (probe == null || probe.length != Face.EMBEDDING_DIMENSION) {
            throw new BusinessException(GateErrorCode.INVALID_EMBEDDING);
        }

        for (float value : probe) {
            // NaN·Infinity 는 벡터 리터럴로도, 거리 계산으로도 성립하지 않는다
            if (!Float.isFinite(value)) {
                throw new BusinessException(GateErrorCode.INVALID_EMBEDDING);
            }
        }
    }

    /**
     * pgvector 가 읽는 리터럴로 바꾼다 — {@code "[0.1,-0.2,…]"}.
     *
     * <p>JDBC 에 {@code float[]} 를 그대로 바인딩할 수 없어서 문자열로 넘기고 SQL 에서
     * {@code CAST(… AS vector)} 한다.
     *
     * <p>🔴 <b>돌아온 문자열은 생체 특징값이다.</b> 로그·예외 메시지·Sentry 태그에 싣지 마세요
     * (GATE_PLAN.md 4-4). 쿼리 파라미터로만 흘러야 한다.
     */
    private static String toVectorLiteral(float[] probe) {
        StringBuilder literal = new StringBuilder(probe.length * 12 + 2).append('[');

        for (int i = 0; i < probe.length; i++) {
            if (i > 0) {
                literal.append(',');
            }
            literal.append(probe[i]);
        }

        return literal.append(']').toString();
    }

    /**
     * 한 프레임이 찾아낸 가장 가까운 티켓.
     *
     * @param runnerUp 2등 유사도. 후보가 하나뿐이었으면 null
     */
    private record Candidate(Long ticketId, double similarity, Double runnerUp, long candidateCount) {

        /**
         * 1등과 2등의 간격.
         *
         * <p>2등이 없으면 <b>무한대</b>다 — 이 회차에 후보가 하나뿐이니 헷갈릴 상대가 없다.
         * 0 으로 두면 마진 조건에 걸려 단 한 명 남은 관객이 영영 보류된다.
         */
        double margin() {
            return runnerUp == null ? Double.POSITIVE_INFINITY : similarity - runnerUp;
        }
    }
}
