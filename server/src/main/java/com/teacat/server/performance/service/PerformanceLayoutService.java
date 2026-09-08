package com.teacat.server.performance.service;

import com.teacat.server.booking.repository.PerformanceSeatRepository;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.performance.dto.request.PerformanceLayoutUpdateRequest;
import com.teacat.server.performance.dto.response.PerformanceLayoutResponse;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceGeneralRepository;
import com.teacat.server.stadium.entity.StadiumLayout;
import com.teacat.server.stadium.exception.StadiumErrorCode;
import com.teacat.server.stadium.repository.SeatRepository;
import com.teacat.server.stadium.repository.StadiumLayoutRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PerformanceLayoutService {

    private final PerformanceGeneralRepository performanceRepository;
    private final StadiumLayoutRepository layoutRepository;
    private final SeatRepository seatRepository;
    private final PerformanceSeatRepository performanceSeatRepository;
    private final FileStorageService fileStorageService;

    public PerformanceLayoutResponse getLayout(Long performanceId) {
        return toResponse(getPerformance(performanceId));
    }

    @Transactional
    public PerformanceLayoutResponse updateLayout(Long performanceId, PerformanceLayoutUpdateRequest request) {
        PerformanceGeneral performance = getPerformance(performanceId);
        StadiumLayout layout = layoutRepository.findByIdWithStadium(request.stadiumLayoutId())
                .orElseThrow(() -> new BusinessException(StadiumErrorCode.LAYOUT_NOT_FOUND));
        if (!layout.getStadium().getId().equals(performance.getStadium().getId())) {
            throw new BusinessException(PerformanceErrorCode.PERFORMANCE_LAYOUT_MISMATCH);
        }
        if (!layout.getId().equals(performance.getStadiumLayout().getId())
                && performance.isTicketingStarted(LocalDateTime.now())) {
            throw new BusinessException(PerformanceErrorCode.PERFORMANCE_LAYOUT_LOCKED);
        }

        List<Long> blockedSeatIds = new ArrayList<>(
                new LinkedHashSet<>(request.blockedSeatIdsOrEmpty()));
        if (!blockedSeatIds.isEmpty()
                && seatRepository.countByLayoutIdAndIds(layout.getId(), blockedSeatIds) != blockedSeatIds.size()) {
            throw new BusinessException(PerformanceErrorCode.PERFORMANCE_LAYOUT_MISMATCH);
        }
        if (!blockedSeatIds.isEmpty()
                && performanceSeatRepository.countHeldOrSold(performanceId, blockedSeatIds) > 0) {
            throw new BusinessException(PerformanceErrorCode.BLOCKED_SEAT_CONFLICT);
        }

        performanceSeatRepository.unblockAll(performanceId);
        if (!blockedSeatIds.isEmpty()) {
            performanceSeatRepository.blockAvailable(performanceId, blockedSeatIds);
        }
        performance.updateLayout(layout, request.elementsOrEmpty(), blockedSeatIds);
        return toResponse(performance);
    }

    @SuppressWarnings("unchecked")
    private PerformanceLayoutResponse toResponse(PerformanceGeneral performance) {
        Map<String, Object> configuration = performance.getLayoutElements();
        List<Map<String, Object>> elements = configuration.get("elements") instanceof List<?> value
                ? (List<Map<String, Object>>) value : List.of();
        List<Long> blocked = configuration.get("blockedSeatIds") instanceof List<?> value
                ? value.stream().filter(Number.class::isInstance)
                .map(Number.class::cast).map(Number::longValue).toList() : List.of();
        StadiumLayout layout = performance.getStadiumLayout();
        return new PerformanceLayoutResponse(
                performance.getId(), performance.getStadium().getId(), layout.getId(), layout.getName(),
                fileStorageService.presignedUrl(layout.getImageKey()), layout.getWidth(), layout.getHeight(),
                layout.getLayoutElements(), elements, blocked);
    }

    private PerformanceGeneral getPerformance(Long performanceId) {
        return performanceRepository.findByIdWithStadiumAndLayout(performanceId)
                .orElseThrow(() -> new BusinessException(PerformanceErrorCode.PERFORMANCE_NOT_FOUND));
    }
}
