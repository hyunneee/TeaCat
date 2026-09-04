package com.teacat.server.performance.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.performance.dto.response.BookingStatusResponse;
import com.teacat.server.performance.dto.response.ScheduleDetailResponse;
import com.teacat.server.performance.entity.BookingOpenStatus;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * 회차 조회 (API-203, API-206).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ScheduleService {

    private final PerformanceDetailRepository performanceDetailRepository;

    /** 회차 단건 조회 (API-203) */
    public ScheduleDetailResponse getSchedule(Long scheduleId) {
        return ScheduleDetailResponse.of(getDetail(scheduleId), LocalDateTime.now());
    }

    /**
     * 예매 오픈 상태 · 서버 시각 조회 (API-206).
     *
     * 클라이언트 시계가 서버보다 빠르면 오픈 전에 요청이 몰리고, 느리면 오픈을 놓친다.
     * 그래서 상태 판단과 기준 시각을 모두 서버가 내려준다.
     */
    public BookingStatusResponse getBookingStatus(Long scheduleId) {
        PerformanceDetail detail = getDetail(scheduleId);

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime ticketingStartAt = detail.getPerformance().getTicketingStartAt();
        BookingOpenStatus status = detail.bookingStatus(now);

        long secondsUntilOpen = status == BookingOpenStatus.BEFORE
                ? Math.max(0, Duration.between(now, ticketingStartAt).toSeconds())
                : 0L;

        return new BookingStatusResponse(detail.getId(), status, ticketingStartAt, now, secondsUntilOpen);
    }

    private PerformanceDetail getDetail(Long scheduleId) {
        return performanceDetailRepository.findWithPerformanceById(scheduleId)
                .orElseThrow(() -> new BusinessException(PerformanceErrorCode.SCHEDULE_NOT_FOUND));
    }
}
