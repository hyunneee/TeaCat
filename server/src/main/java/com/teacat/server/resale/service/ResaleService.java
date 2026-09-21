package com.teacat.server.resale.service;

import com.teacat.server.booking.exception.BookingErrorCode;
import com.teacat.server.booking.repository.PerformanceSeatRepository;
import com.teacat.server.booking.repository.PerformanceSeatRepository.AreaAvailabilityView;
import com.teacat.server.common.config.BookingPolicyProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.performance.entity.BookingOpenStatus;
import com.teacat.server.performance.entity.PerformanceArea;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.performance.repository.PerformanceAreaRepository;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.resale.dto.request.ApplyResaleRequest;
import com.teacat.server.resale.dto.response.ResaleEntryResponse;
import com.teacat.server.resale.dto.response.ResaleSectionResponse;
import com.teacat.server.resale.entity.ResaleEntry;
import com.teacat.server.resale.entity.ResaleEntryStatus;
import com.teacat.server.resale.entity.SeatDraw;
import com.teacat.server.resale.exception.ResaleErrorCode;
import com.teacat.server.resale.repository.ResaleEntryRepository;
import com.teacat.server.resale.repository.ResaleEntryRepository.AreaWaitingCount;
import com.teacat.server.resale.repository.SeatDrawRepository;
import com.teacat.server.ticket.entity.TicketStatus;
import com.teacat.server.ticket.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 취소표 대기 — 사용자가 보는 쪽.
 *
 * <p>대기는 <b>매진된 구역에만</b> 걸 수 있다. 남은 자리가 있으면 그냥 예매하면 되는 자리다.
 * 추첨은 취소표가 생기는 순간 서버가 돌린다({@link ResaleDrawService}) — 여기에는 "추첨 돌리기" 가 없다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResaleService {

    private static final List<ResaleEntryStatus> VISIBLE_STATUSES = Arrays.stream(ResaleEntryStatus.values())
            .filter(ResaleEntryStatus::isVisibleToUser).toList();

    private final ResaleEntryRepository resaleEntryRepository;
    private final SeatDrawRepository seatDrawRepository;
    private final PerformanceDetailRepository performanceDetailRepository;
    private final PerformanceAreaRepository performanceAreaRepository;
    private final PerformanceSeatRepository performanceSeatRepository;
    private final TicketRepository ticketRepository;
    private final BookingPolicyProperties bookingPolicy;
    private final ResaleDrawService drawService;

    /** 구역별 대기 인원·가격·매진 여부 */
    @Transactional(readOnly = true)
    public List<ResaleSectionResponse> sections(Long scheduleId) {
        PerformanceDetail detail = requireDetail(scheduleId);

        Map<Long, Long> waitingByArea = resaleEntryRepository.countWaitingByArea(scheduleId).stream()
                .collect(Collectors.toMap(AreaWaitingCount::getAreaId, AreaWaitingCount::getWaitingCount));
        Map<Long, AreaAvailabilityView> availability = availabilityByArea(scheduleId);

        return performanceAreaRepository.findAllByPerformanceId(detail.getPerformance().getId()).stream()
                .filter(area -> area.getPrice() != null)
                .sorted(Comparator.comparing(area -> area.getArea().getId()))
                .map(area -> ResaleSectionResponse.of(area,
                        waitingByArea.getOrDefault(area.getArea().getId(), 0L),
                        isSoldOut(availability.get(area.getArea().getId()))))
                .toList();
    }

    @Transactional
    public ResaleEntryResponse apply(Long userId, Long scheduleId, ApplyResaleRequest request) {
        PerformanceDetail detail = requireDetail(scheduleId);
        LocalDateTime now = LocalDateTime.now();

        BookingOpenStatus openStatus = detail.bookingStatus(now);
        if (openStatus != BookingOpenStatus.OPEN && openStatus != BookingOpenStatus.SOLDOUT) {
            throw new BusinessException(ResaleErrorCode.TICKETING_NOT_OPEN);
        }
        // 취소 마감이 지나면 취소표가 나올 수 없다. 대기를 받아도 영영 당첨이 없다
        if (!detail.getPerformanceDate().minus(bookingPolicy.cancelDeadlineLead()).isAfter(now)) {
            throw new BusinessException(ResaleErrorCode.WAITLIST_CLOSED);
        }

        PerformanceArea area = performanceAreaRepository
                .findById(new PerformanceArea.PerformanceAreaId(detail.getPerformance().getId(),
                        request.sectionId()))
                .filter(pa -> pa.getPrice() != null)
                .orElseThrow(() -> new BusinessException(ResaleErrorCode.SECTION_NOT_FOUND));

        if (request.quantity() > bookingPolicy.maxTicketsPerUser()) {
            throw new BusinessException(ResaleErrorCode.QUANTITY_EXCEEDED);
        }
        long owned = ticketRepository.countByUserIdAndPerformanceDetailIdAndStatus(
                userId, scheduleId, TicketStatus.CONFIRMED);
        if (owned >= bookingPolicy.maxTicketsPerUser()) {
            throw new BusinessException(ResaleErrorCode.TICKET_LIMIT_EXCEEDED);
        }

        if (!isSoldOut(availabilityByArea(scheduleId).get(request.sectionId()))) {
            throw new BusinessException(ResaleErrorCode.SECTION_NOT_SOLD_OUT);
        }

        if (resaleEntryRepository.existsByUserIdAndPerformanceDetailIdAndAreaIdAndStatus(
                userId, scheduleId, request.sectionId(), ResaleEntryStatus.WAITING)) {
            throw new BusinessException(ResaleErrorCode.ALREADY_WAITING);
        }

        ResaleEntry entry;
        try {
            entry = resaleEntryRepository.saveAndFlush(
                    ResaleEntry.waiting(userId, scheduleId, request.sectionId(), request.quantity()));
        } catch (DataIntegrityViolationException e) {
            // 같은 사람의 두 요청이 동시에 들어왔다 (uq_resale_entries_waiting)
            throw new BusinessException(ResaleErrorCode.ALREADY_WAITING);
        }
        log.info("취소표 대기 신청 entryId={} userId={} scheduleId={} areaId={}", entry.getId(), userId,
                scheduleId, request.sectionId());
        return ResaleEntryResponse.of(entry, detail, area, null);
    }

    /** 내 대기 내역. 스스로 접은 것(취소·포기)은 보이지 않는다 */
    @Transactional(readOnly = true)
    public List<ResaleEntryResponse> mine(Long userId) {
        return toResponses(resaleEntryRepository.findByUserIdAndStatusInOrderByCreatedAtDesc(
                userId, VISIBLE_STATUSES));
    }

    /**
     * 대기 취소 또는 당첨 포기. 포기하면 좌석을 되돌려 새 추첨을 열어야 하므로(체인 호출)
     * <b>트랜잭션 밖</b>에서 {@link ResaleDrawService} 가 이어서 처리한다.
     *
     * @param rejoin 당첨을 포기하면서 다시 대기를 고른 경우. 대기 취소에는 의미가 없다
     */
    public void cancel(Long userId, Long entryId, boolean rejoin) {
        drawService.cancelOrForfeit(userId, entryId, rejoin);
    }

    /* ── 내부 ─────────────────────────────────────────────────── */

    private PerformanceDetail requireDetail(Long scheduleId) {
        return performanceDetailRepository.findById(scheduleId)
                .orElseThrow(() -> new BusinessException(BookingErrorCode.PERFORMANCE_DETAIL_NOT_FOUND));
    }

    private Map<Long, AreaAvailabilityView> availabilityByArea(Long scheduleId) {
        return performanceSeatRepository.findAvailabilityByArea(scheduleId).stream()
                .collect(Collectors.toMap(AreaAvailabilityView::getAreaId, Function.identity()));
    }

    /** 회차 좌석이 아직 없는 구역(행 없음)은 매진이 아니다 — 기다릴 대상이 없다 */
    private static boolean isSoldOut(AreaAvailabilityView view) {
        return view != null && view.getTotalCount() > 0 && view.getAvailableCount() == 0;
    }

    private List<ResaleEntryResponse> toResponses(List<ResaleEntry> entries) {
        if (entries.isEmpty()) {
            return List.of();
        }
        Map<Long, PerformanceDetail> details = performanceDetailRepository.findAllById(
                        entries.stream().map(ResaleEntry::getPerformanceDetailId).distinct().toList())
                .stream().collect(Collectors.toMap(PerformanceDetail::getId, Function.identity()));

        Map<Long, Map<Long, PerformanceArea>> areasByPerformance = new HashMap<>();
        for (PerformanceDetail detail : details.values()) {
            Long performanceId = detail.getPerformance().getId();
            areasByPerformance.computeIfAbsent(performanceId, id ->
                    performanceAreaRepository.findAllByPerformanceId(id).stream()
                            .collect(Collectors.toMap(pa -> pa.getArea().getId(), Function.identity())));
        }

        Map<Long, SeatDraw> draws = seatDrawRepository.findAllById(
                        entries.stream().map(ResaleEntry::getSeatDrawId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(SeatDraw::getId, Function.identity()));

        return entries.stream().map(entry -> {
            PerformanceDetail detail = details.get(entry.getPerformanceDetailId());
            PerformanceArea area = detail == null ? null
                    : areasByPerformance.getOrDefault(detail.getPerformance().getId(), Map.of())
                            .get(entry.getAreaId());
            SeatDraw draw = entry.getSeatDrawId() == null ? null : draws.get(entry.getSeatDrawId());
            return ResaleEntryResponse.of(entry, detail, area, draw);
        }).toList();
    }
}
