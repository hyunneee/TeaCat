package com.teacat.server.performance.service;

import com.teacat.server.common.config.BookingPolicyProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.performance.dto.response.BookingPolicyResponse;
import com.teacat.server.performance.dto.response.PerformanceAreaResponse;
import com.teacat.server.performance.dto.response.ConcertDetailResponse;
import com.teacat.server.performance.dto.response.ConcertListResponse;
import com.teacat.server.performance.dto.response.ConcertSummaryResponse;
import com.teacat.server.performance.dto.response.ScheduleSummaryResponse;
import com.teacat.server.performance.dto.response.PerformanceViewResponse;
import com.teacat.server.performance.entity.BookingOpenStatus;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceAreaRepository;
import com.teacat.server.ticket.repository.TicketRepository;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.performance.repository.PerformanceGeneralRepository;
import com.teacat.server.performance.repository.PerformanceViewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 공연 조회 (API-201, 202, 204, 205, 207).
 *
 * 비공개(hidden_at) 공연은 클라이언트에게 보이면 안 되므로
 * 조회 쿼리마다 공개 조건을 직접 건다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PerformanceService {

    private final PerformanceGeneralRepository performanceGeneralRepository;
    private final PerformanceDetailRepository performanceDetailRepository;
    private final PerformanceAreaRepository performanceAreaRepository;
    private final TicketRepository ticketRepository;
    private final ScheduleSeatAvailability seatAvailability;
    private final FileStorageService fileStorageService;
    private final BookingPolicyProperties bookingPolicy;
    private final PerformanceViewRepository performanceViewRepository;

    @Transactional
    public PerformanceViewResponse recordView(Long concertId, String sessionHeader) {
        if (!performanceGeneralRepository.existsByIdAndHiddenAtIsNull(concertId)) {
            throw new BusinessException(PerformanceErrorCode.PERFORMANCE_NOT_FOUND);
        }
        final UUID sessionId;
        try {
            sessionId = UUID.fromString(sessionHeader);
        } catch (RuntimeException e) {
            throw new BusinessException(PerformanceErrorCode.INVALID_VIEW_SESSION);
        }
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime bucket = now.withMinute(now.getMinute() < 30 ? 0 : 30).withSecond(0).withNano(0);
        return new PerformanceViewResponse(performanceViewRepository.record(concertId, sessionId, bucket));
    }

    /**
     * 공연 목록 조회 (API-201).
     *
     * @param past true 면 회차가 전부 지난 공연만. 기본(false)은 남은 회차가 있는 공연만
     */
    public ConcertListResponse getConcerts(String keyword, boolean past, Long cursor, int size) {
        LocalDateTime now = LocalDateTime.now();

        // 다음 페이지가 있는지 알아내려고 한 건 더 가져온다
        List<PerformanceGeneral> found = performanceGeneralRepository.findPage(
                now.toLocalDate(),
                now,
                past,
                cursor,
                toTitlePattern(keyword),
                PageRequest.of(0, size + 1));

        boolean hasNext = found.size() > size;
        List<PerformanceGeneral> page = hasNext ? found.subList(0, size) : found;

        List<ConcertSummaryResponse> concerts = toSummaries(page, now);

        Long nextCursor = hasNext ? page.getLast().getId() : null;

        return ConcertListResponse.of(concerts, nextCursor, hasNext);
    }

    /**
     * 목록 항목으로 옮기면서 <b>대표 예매 상태</b>를 붙인다.
     *
     * <p>회차는 공연마다 따로 읽지 않고 한 번에 읽어 나눈다 — 목록 한 장에 쿼리가 공연 수만큼
     * 늘어나는 걸 막는다. 상태 계산 규칙은 {@link BookingOpenStatus#aggregate} 에 있다.
     */
    private List<ConcertSummaryResponse> toSummaries(List<PerformanceGeneral> performances,
            LocalDateTime now) {
        if (performances.isEmpty()) {
            return List.of();
        }

        List<PerformanceDetail> allSchedules = performanceDetailRepository.findByPerformanceIdIn(
                performances.stream().map(PerformanceGeneral::getId).toList());

        Map<Long, List<PerformanceDetail>> schedulesByConcert = allSchedules.stream()
                .collect(Collectors.groupingBy(detail -> detail.getPerformance().getId()));

        /* 매진 판정도 한 번에 묻는다. 이게 없으면 회차가 전부 팔린 공연도 목록에서
           "예매중" 으로 보인다 — 들어가 보면 고를 좌석이 없다 (QA 에서 잡힌 증상) */
        Set<Long> soldOut = seatAvailability.findSoldOut(
                allSchedules.stream().map(PerformanceDetail::getId).toList());

        return performances.stream()
                .map(p -> ConcertSummaryResponse.of(
                        p,
                        fileStorageService.presignedUrl(p.getPosterImageKey()),
                        BookingOpenStatus.aggregate(
                                schedulesByConcert.getOrDefault(p.getId(), List.of()).stream()
                                        .map(detail -> detail.bookingStatus(now)
                                                .soldOutIf(soldOut.contains(detail.getId())))
                                        .toList(),
                                p.getTicketingStartAt(),
                                now)))
                .toList();
    }

    /**
     * 검색어를 LIKE 패턴으로 바꾼다. 검색어가 없으면 전체를 뜻하는 '%' 다.
     *
     * 사용자가 넣은 %, _ 는 와일드카드가 아니라 글자 그대로 찾아야 하므로 이스케이프한다.
     */
    private String toTitlePattern(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return "%";
        }

        String escaped = keyword.trim()
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");

        return "%" + escaped + "%";
    }

    /** 공연 상세 조회 (API-202) */
    public ConcertDetailResponse getConcert(Long concertId) {
        PerformanceGeneral performance = getPerformance(concertId);

        return ConcertDetailResponse.of(
                performance,
                findSchedules(concertId),
                fileStorageService.presignedUrl(performance.getPosterImageKey()),
                fileStorageService.presignedUrl(performance.getDetailImageKey()));
    }

    /** 공연 회차 목록 조회 (API-204) */
    public List<ScheduleSummaryResponse> getSchedules(Long concertId) {
        // 없는 공연에 빈 배열을 주면 클라이언트가 "회차가 없는 공연"으로 오해한다
        if (!performanceGeneralRepository.existsByIdAndHiddenAtIsNull(concertId)) {
            throw new BusinessException(PerformanceErrorCode.PERFORMANCE_NOT_FOUND);
        }

        return findSchedules(concertId);
    }

    /** 공연 예매 정책 조회 (API-205) */
    public BookingPolicyResponse getBookingPolicy(Long concertId) {
        if (!performanceGeneralRepository.existsByIdAndHiddenAtIsNull(concertId)) {
            throw new BusinessException(PerformanceErrorCode.PERFORMANCE_NOT_FOUND);
        }

        return BookingPolicyResponse.of(concertId, bookingPolicy);
    }

    /**
     * 공연 구역의 등급·가격 (API-268 의 조회 버전).
     *
     * 지금까지 이 정보는 관리자 저장 API 의 응답에만 있었다. 그런데 구역 선택 화면이
     * 가격을 보여줘야 하고 결제 금액도 여기서 나오므로 공개 조회가 필요하다.
     *
     * 등급·가격은 null 일 수 있다 — 구역만 만들고 설정을 아직 안 한 상태다.
     * 프론트는 가격이 없는 구역을 예매 불가로 막는다.
     */
    public List<PerformanceAreaResponse> getAreas(Long concertId) {
        if (!performanceGeneralRepository.existsByIdAndHiddenAtIsNull(concertId)) {
            throw new BusinessException(PerformanceErrorCode.PERFORMANCE_NOT_FOUND);
        }

        // 판매량은 티켓에서 센다 — performance_areas.sold_cnt 는 아무도 갱신하지 않아 없앴다
        Map<Long, Long> soldByArea = ticketRepository.countSoldByArea(concertId).stream()
                .collect(Collectors.toMap(
                        TicketRepository.AreaSoldCount::getAreaId,
                        TicketRepository.AreaSoldCount::getSoldCount));

        return performanceAreaRepository.findAllByPerformanceId(concertId).stream()
                .map(pa -> PerformanceAreaResponse.of(
                        pa, soldByArea.getOrDefault(pa.getArea().getId(), 0L)))
                .toList();
    }

    /** 오픈 예정 공연 목록 조회 (API-207) */
    public List<ConcertSummaryResponse> getUpcomingOpenConcerts(int size) {
        LocalDateTime now = LocalDateTime.now();

        return toSummaries(
                performanceGeneralRepository.findUpcomingOpen(
                        now.toLocalDate(), now, PageRequest.of(0, size)),
                now);
    }

    private List<ScheduleSummaryResponse> findSchedules(Long concertId) {
        LocalDateTime now = LocalDateTime.now();

        List<PerformanceDetail> details =
                performanceDetailRepository.findByPerformanceIdOrderByPerformanceNumAsc(concertId);

        /* 매진 여부는 좌석을 세서 판정한다. 회차 수만큼 세면 N+1 이라 한 번에 묻는다.
           (회차 상태의 SOLD_OUT 은 운영자가 손으로 바꾸는 값이라 믿을 수 없다) */
        Set<Long> soldOut = seatAvailability.findSoldOut(
                details.stream().map(PerformanceDetail::getId).toList());

        return details.stream()
                .map(detail -> ScheduleSummaryResponse.of(detail, now, soldOut.contains(detail.getId())))
                .toList();
    }

    /** 클라이언트 조회는 공개 상태인 공연만 본다 */
    private PerformanceGeneral getPerformance(Long concertId) {
        return performanceGeneralRepository.findVisibleById(concertId)
                .orElseThrow(() -> new BusinessException(PerformanceErrorCode.PERFORMANCE_NOT_FOUND));
    }
}
