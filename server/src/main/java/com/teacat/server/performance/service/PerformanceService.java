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
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceAreaRepository;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.performance.repository.PerformanceGeneralRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

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
    private final FileStorageService fileStorageService;
    private final BookingPolicyProperties bookingPolicy;

    /** 공연 목록 조회 (API-201) */
    public ConcertListResponse getConcerts(String keyword, Long cursor, int size) {
        // 다음 페이지가 있는지 알아내려고 한 건 더 가져온다
        List<PerformanceGeneral> found = performanceGeneralRepository.findPage(
                LocalDate.now(),
                cursor,
                toTitlePattern(keyword),
                PageRequest.of(0, size + 1));

        boolean hasNext = found.size() > size;
        List<PerformanceGeneral> page = hasNext ? found.subList(0, size) : found;

        List<ConcertSummaryResponse> concerts = page.stream()
                .map(p -> ConcertSummaryResponse.of(p, fileStorageService.presignedUrl(p.getPosterImageKey())))
                .toList();

        Long nextCursor = hasNext ? page.getLast().getId() : null;

        return ConcertListResponse.of(concerts, nextCursor, hasNext);
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

        return performanceAreaRepository.findAllByPerformanceId(concertId).stream()
                .map(PerformanceAreaResponse::from)
                .toList();
    }

    /** 오픈 예정 공연 목록 조회 (API-207) */
    public List<ConcertSummaryResponse> getUpcomingOpenConcerts(int size) {
        LocalDateTime now = LocalDateTime.now();

        return performanceGeneralRepository.findUpcomingOpen(now.toLocalDate(), now, PageRequest.of(0, size))
                .stream()
                .map(p -> ConcertSummaryResponse.of(p, fileStorageService.presignedUrl(p.getPosterImageKey())))
                .toList();
    }

    private List<ScheduleSummaryResponse> findSchedules(Long concertId) {
        LocalDateTime now = LocalDateTime.now();

        return performanceDetailRepository.findByPerformanceIdOrderByPerformanceNumAsc(concertId).stream()
                .map(detail -> ScheduleSummaryResponse.of(detail, now))
                .toList();
    }

    /** 클라이언트 조회는 공개 상태인 공연만 본다 */
    private PerformanceGeneral getPerformance(Long concertId) {
        return performanceGeneralRepository.findVisibleById(concertId)
                .orElseThrow(() -> new BusinessException(PerformanceErrorCode.PERFORMANCE_NOT_FOUND));
    }
}
