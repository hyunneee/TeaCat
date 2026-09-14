package com.teacat.server.booking.service;

import com.teacat.server.booking.dto.response.ScheduleSeatMapResponse;
import com.teacat.server.booking.dto.response.SeatMapAreaResponse;
import com.teacat.server.booking.dto.response.SeatStatusResponse;
import com.teacat.server.booking.entity.SeatBookingStatus;
import com.teacat.server.booking.exception.BookingErrorCode;
import com.teacat.server.booking.repository.PerformanceSeatRepository;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.performance.entity.PerformanceArea;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.performance.repository.PerformanceAreaRepository;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.stadium.entity.Area;
import com.teacat.server.stadium.entity.Seat;
import com.teacat.server.stadium.repository.SeatRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 좌석맵 조회.
 *
 * <p>세 곳에 흩어진 정보를 한 응답으로 합친다.
 * <pre>
 *   공연장 구역·좌석 (stadium)   좌표, 열·번호       — 회차와 무관, 공연장의 것
 *   공연 구역 설정 (performance) 등급, 가격          — 공연 단위
 *   회차 좌석    (booking)       AVAILABLE/SOLD ...  — 회차 단위
 * </pre>
 *
 * <p>프론트가 세 API 를 각각 부르고 조인하게 두지 않는 이유: 호출 사이에 좌석이
 * 팔리면 "구역 잔여 28석인데 좌석맵엔 27석" 처럼 어긋나 보이고, 3초마다 폴링하는
 * 화면에서 그 어긋남이 계속 눈에 띈다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SeatMapService {

    private final PerformanceDetailRepository performanceDetailRepository;
    private final PerformanceAreaRepository performanceAreaRepository;
    private final PerformanceSeatRepository performanceSeatRepository;
    private final SeatRepository seatRepository;

    /**
     * @param areaId 특정 구역만 볼 때. null 이면 전 구역
     */
    public ScheduleSeatMapResponse getSeatMap(Long scheduleId, Long areaId) {
        PerformanceDetail detail = performanceDetailRepository.findById(scheduleId)
                .orElseThrow(() -> new BusinessException(BookingErrorCode.PERFORMANCE_DETAIL_NOT_FOUND));

        LocalDateTime now = LocalDateTime.now();

        List<PerformanceArea> configured =
                performanceAreaRepository.findAllByPerformanceId(detail.getPerformance().getId());

        List<PerformanceArea> targets = configured.stream()
                .filter(pa -> areaId == null || pa.getArea().getId().equals(areaId))
                .sorted(Comparator.comparing(pa -> pa.getArea().getId()))
                .toList();

        if (targets.isEmpty()) {
            return new ScheduleSeatMapResponse(scheduleId, now, List.of());
        }

        List<Long> areaIds = targets.stream().map(pa -> pa.getArea().getId()).toList();

        // 좌석 좌표(공연장) 와 좌석 상태(회차) 를 각각 한 번씩만 읽는다
        Map<Long, List<Seat>> seatsByArea = seatRepository.findByAreaIdIn(areaIds).stream()
                .collect(Collectors.groupingBy(seat -> seat.getArea().getId()));

        /* 만료 판정은 SQL 안(DB 시계)에서 끝나서 온다.
           자바에서 비교하면 앱(KST)과 DB(UTC) 시계가 어긋나 좌석맵과 선점 API 가
           서로 다른 답을 낸다 — findEffectiveStatuses 주석 참고 */
        Map<Long, SeatBookingStatus> statusBySeatId =
                performanceSeatRepository.findEffectiveStatuses(scheduleId).stream()
                        .collect(Collectors.toMap(
                                PerformanceSeatRepository.SeatStatusView::getSeatId,
                                view -> SeatBookingStatus.valueOf(view.getStatus())));

        return new ScheduleSeatMapResponse(scheduleId, now, targets.stream()
                .map(pa -> toArea(pa, seatsByArea.getOrDefault(pa.getArea().getId(), List.of()), statusBySeatId))
                .toList());
    }

    private SeatMapAreaResponse toArea(PerformanceArea performanceArea,
                                       List<Seat> seats,
                                       Map<Long, SeatBookingStatus> statusBySeatId) {
        Area area = performanceArea.getArea();

        var orderedSeats = seats.stream()
                .sorted(Comparator.comparing(Seat::getRowLabel).thenComparingInt(Seat::getSeatNumber))
                .toList();
        if (!performanceArea.isSoldAsSeated() && performanceArea.getMaxCnt() != null) {
            orderedSeats = orderedSeats.stream().limit(performanceArea.getMaxCnt()).toList();
        }

        List<SeatStatusResponse> mapped = orderedSeats.stream()
                .map(seat -> new SeatStatusResponse(
                        seat.getId(),
                        seat.getRowLabel(),
                        seat.getSeatNumber(),
                        seat.getSeatX(),
                        seat.getSeatY(),
                        // 회차 좌석이 아직 생성되지 않았으면 상태 행이 없다.
                        // 팔린 것도 잡힌 것도 아니므로 BLOCKED — 예매는 못 하되 도면은 보인다
                        statusBySeatId.getOrDefault(seat.getId(), SeatBookingStatus.BLOCKED)))
                .toList();

        int available = (int) mapped.stream()
                .filter(seat -> seat.status() == SeatBookingStatus.AVAILABLE)
                .count();

        return new SeatMapAreaResponse(
                area.getId(),
                area.getAreaCode(),
                area.getType(),
                performanceArea.getGrade(),
                performanceArea.getPrice(),
                area.getAreaX(),
                area.getAreaY(),
                area.getWidth(),
                area.getHeight(),
                mapped.size(),
                available,
                mapped);
    }
}
