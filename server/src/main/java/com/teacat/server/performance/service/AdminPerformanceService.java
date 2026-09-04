package com.teacat.server.performance.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.performance.dto.request.ConcertCreateRequest;
import com.teacat.server.performance.dto.request.ConcertUpdateRequest;
import com.teacat.server.performance.dto.request.ScheduleCreateRequest;
import com.teacat.server.performance.dto.response.ConcertCreateResponse;
import com.teacat.server.performance.dto.response.ScheduleCreateResponse;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.performance.repository.PerformanceGeneralRepository;
import com.teacat.server.stadium.entity.Stadium;
import com.teacat.server.stadium.repository.StadiumRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;

/**
 * 공연 관리 (API-261 ~ 263, 265).
 *
 * 이미지는 MinIO 에 올리고 DB 에는 key 만 남긴다.
 */
@Service
@Slf4j
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminPerformanceService {

    private static final String POSTER_DIRECTORY = "performance/poster";
    private static final String DETAIL_IMAGE_DIRECTORY = "performance/detail";

    private final PerformanceGeneralRepository performanceGeneralRepository;
    private final PerformanceDetailRepository performanceDetailRepository;
    private final StadiumRepository stadiumRepository;
    private final FileStorageService fileStorageService;

    /** 공연 등록 (API-261) */
    @Transactional
    public ConcertCreateResponse create(ConcertCreateRequest request) {
        Stadium stadium = getStadium(request.stadiumId());

        if (request.visibleFrom().isAfter(request.ticketingStartAt().toLocalDate())) {
            throw new BusinessException(PerformanceErrorCode.INVALID_VISIBLE_FROM);
        }

        String posterKey = uploadIfPresent(request.poster(), POSTER_DIRECTORY);
        String detailImageKey = uploadIfPresent(request.detailImage(), DETAIL_IMAGE_DIRECTORY);

        PerformanceGeneral performance = performanceGeneralRepository.save(
                PerformanceGeneral.create(
                        stadium,
                        request.title(),
                        request.ticketingStartAt(),
                        request.visibleFrom(),
                        posterKey,
                        detailImageKey));

        return ConcertCreateResponse.of(performance.getId());
    }

    /**
     * 공연 수정 (API-262).
     *
     * 티켓팅이 시작된 뒤에는 제목만 바꿀 수 있다.
     * 공연장·티켓팅 시각·노출 시작일은 예매자가 이미 보고 결정한 정보라 뒤늦게 바꾸면 안 된다.
     */
    @Transactional
    public void update(Long concertId, ConcertUpdateRequest request) {
        if (request.isEmpty()) {
            throw new BusinessException(PerformanceErrorCode.NOTHING_TO_UPDATE);
        }

        PerformanceGeneral performance = getPerformance(concertId);

        if (performance.isTicketingStarted(LocalDateTime.now()) && request.touchesLockedFields()) {
            throw new BusinessException(PerformanceErrorCode.TICKETING_ALREADY_STARTED);
        }

        Stadium stadium = request.stadiumId() != null ? getStadium(request.stadiumId()) : null;

        LocalDateTime ticketingStartAt = request.ticketingStartAt() != null
                ? request.ticketingStartAt()
                : performance.getTicketingStartAt();
        var visibleFrom = request.visibleFrom() != null ? request.visibleFrom() : performance.getVisibleFrom();

        if (visibleFrom.isAfter(ticketingStartAt.toLocalDate())) {
            throw new BusinessException(PerformanceErrorCode.INVALID_VISIBLE_FROM);
        }

        performance.update(request.title(), stadium, request.ticketingStartAt(), request.visibleFrom());
    }

    /**
     * 공연 삭제 · 비공개 (API-263).
     *
     * 예매 이력이 없으면 물리 삭제하고, 있으면 비공개(소프트 삭제)로 남긴다.
     * 이력이 있는데 지워버리면 발권된 티켓이 어떤 공연이었는지 추적할 수 없게 된다.
     */
    @Transactional
    public void deleteOrHide(Long concertId) {
        PerformanceGeneral performance = getPerformance(concertId);

        if (performanceGeneralRepository.existsTicketByPerformanceId(concertId)) {
            performance.hide(LocalDateTime.now());
            return;
        }

        // 자식 행이 FK 로 묶여 있어 아래에서 위로 지운다
        performanceGeneralRepository.deleteSeatsByPerformanceId(concertId);
        performanceGeneralRepository.deleteDetailsByPerformanceId(concertId);
        performanceGeneralRepository.deleteAreasByPerformanceId(concertId);
        performanceGeneralRepository.delete(performance);

        deleteQuietly(performance.getPosterImageKey());
        deleteQuietly(performance.getDetailImageKey());
    }

    /**
     * 회차 등록 (API-265).
     *
     * 회차 번호를 생략하면 마지막 번호 + 1 을 붙인다.
     * (performance_general_id, performance_num) 에 UNIQUE 제약이 있어 중복은 미리 막는다.
     */
    @Transactional
    public ScheduleCreateResponse createSchedule(Long concertId, ScheduleCreateRequest request) {
        PerformanceGeneral performance = getPerformance(concertId);

        // 티켓팅 시작일보다 앞선 공연일은 예매가 불가능한 회차가 된다
        if (request.performanceDate().isBefore(performance.getTicketingStartAt())) {
            throw new BusinessException(PerformanceErrorCode.INVALID_PERFORMANCE_DATE);
        }

        int performanceNum = request.performanceNum() != null
                ? request.performanceNum()
                : performanceDetailRepository.findMaxPerformanceNum(concertId) + 1;

        if (performanceDetailRepository.existsByPerformanceIdAndPerformanceNum(concertId, performanceNum)) {
            throw new BusinessException(PerformanceErrorCode.DUPLICATE_SCHEDULE_NUM);
        }

        PerformanceDetail detail = performanceDetailRepository.save(
                PerformanceDetail.create(performance, performanceNum, request.performanceDate()));

        return ScheduleCreateResponse.of(detail.getId(), detail.getPerformanceNum());
    }

    private String uploadIfPresent(MultipartFile file, String directory) {
        return (file == null || file.isEmpty()) ? null : fileStorageService.uploadImage(file, directory);
    }

    /**
     * 공연 행은 이미 지워졌으므로, 이미지 삭제가 실패해도 요청 전체를 되돌리지 않는다.
     * 남은 파일은 고아 객체로 남을 뿐이라 나중에 정리하면 된다.
     */
    private void deleteQuietly(String key) {
        try {
            fileStorageService.delete(key);
        } catch (RuntimeException e) {
            log.warn("공연 이미지 삭제 실패. 수동 정리 필요. key={}", key, e);
        }
    }

    private PerformanceGeneral getPerformance(Long concertId) {
        return performanceGeneralRepository.findById(concertId)
                .orElseThrow(() -> new BusinessException(PerformanceErrorCode.PERFORMANCE_NOT_FOUND));
    }

    private Stadium getStadium(Long stadiumId) {
        return stadiumRepository.findById(stadiumId)
                .orElseThrow(() -> new BusinessException(PerformanceErrorCode.STADIUM_NOT_FOUND));
    }
}
