package com.teacat.server.performance.service;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.performance.dto.request.ScheduleUpdateRequest;
import com.teacat.server.performance.dto.response.SeatGenerateResponse;
import com.teacat.server.performance.entity.PerformanceArea;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.booking.repository.PerformanceSeatRepository;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceAreaRepository;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 회차 관리 (API-266, 267, 269).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminScheduleService {

    private final PerformanceDetailRepository performanceDetailRepository;
    private final PerformanceAreaRepository performanceAreaRepository;
    private final PerformanceSeatRepository performanceSeatRepository;

    /** 회차 수정 (API-266) */
    @Transactional
    public void update(Long scheduleId, ScheduleUpdateRequest request, AuthUser actor) {
        if (request.isEmpty()) {
            throw new BusinessException(PerformanceErrorCode.NOTHING_TO_UPDATE);
        }

        PerformanceDetail detail = getManageableDetail(scheduleId, actor);

        if (request.performanceDate() != null
                && request.performanceDate().isBefore(detail.getPerformance().getTicketingStartAt())) {
            throw new BusinessException(PerformanceErrorCode.INVALID_PERFORMANCE_DATE);
        }

        detail.update(request.performanceDate(), request.status());
    }

    /**
     * 회차 삭제 (API-267).
     *
     * 예매 이력이 있으면 삭제하지 않는다. 발권된 티켓이 어느 회차였는지 잃어버리기 때문이다.
     * 좌석 행은 판매 상태일 뿐이라 회차와 함께 지운다.
     * 지운 뒤에는 남은 회차 번호를 일시 순으로 다시 매겨 1, 3 처럼 구멍이 남지 않게 한다.
     */
    @Transactional
    public void delete(Long scheduleId, AuthUser actor) {
        PerformanceDetail detail = getManageableDetail(scheduleId, actor);

        if (performanceDetailRepository.existsTicketByScheduleId(scheduleId)) {
            throw new BusinessException(PerformanceErrorCode.SCHEDULE_HAS_TICKETS);
        }

        Long performanceId = detail.getPerformance().getId();

        performanceDetailRepository.deleteSeatsByScheduleId(scheduleId);
        performanceDetailRepository.delete(detail);

        // 빠진 번호를 남기지 않는다 — 남은 회차를 일시 순으로 1 부터 다시 매긴다 (등록 API-265 와 같은 규칙)
        performanceDetailRepository.negatePerformanceNums(performanceId);
        performanceDetailRepository.renumberByDate(performanceId);
    }

    /**
     * 회차 좌석 생성 (API-269).
     *
     * 공연 구역 설정(API-268)에서 판매하기로 한 구역의 좌석만 만든다.
     * 지정석은 배치의 실제 좌석을, 스탠딩은 max_cnt 개의 가상 좌석을 만든다.
     *
     * 이 API 를 돌리지 않으면 좌석 조회(API-302)가 읽을 데이터가 없다.
     */
    @Transactional
    public SeatGenerateResponse generateSeats(Long scheduleId, AuthUser actor) {
        PerformanceDetail detail = getManageableDetail(scheduleId, actor);

        List<PerformanceArea> configuredAreas =
                performanceAreaRepository.findAllByPerformanceId(detail.getPerformance().getId());

        if (configuredAreas.isEmpty()) {
            throw new BusinessException(PerformanceErrorCode.AREA_NOT_CONFIGURED);
        }

        int createdSeatCount = performanceSeatRepository.insertMissingForSchedule(scheduleId);
        if (createdSeatCount == 0 && performanceSeatRepository.existsByIdPerformanceDetailId(scheduleId)) {
            throw new BusinessException(PerformanceErrorCode.SEATS_ALREADY_GENERATED);
        }
        if (createdSeatCount == 0) {
            throw new BusinessException(PerformanceErrorCode.NO_SEATS_TO_GENERATE);
        }
        return SeatGenerateResponse.of(scheduleId, createdSeatCount, configuredAreas.size());
    }

    /**
     * 회차는 공연에 속하므로 그 공연을 다룰 수 있는 사람만 회차를 다룰 수 있다.
     * ADMIN 은 전체, PERFORMANCE 는 자기가 등록한 공연만
     * (AdminPerformanceService.getManageablePerformance 와 같은 규칙).
     */
    private PerformanceDetail getManageableDetail(Long scheduleId, AuthUser actor) {
        PerformanceDetail detail = performanceDetailRepository.findWithPerformanceById(scheduleId)
                .orElseThrow(() -> new BusinessException(PerformanceErrorCode.SCHEDULE_NOT_FOUND));

        if (!actor.isAdmin() && !detail.getPerformance().isOwnedBy(actor.id())) {
            throw new BusinessException(PerformanceErrorCode.NOT_OWNER);
        }

        return detail;
    }
}
