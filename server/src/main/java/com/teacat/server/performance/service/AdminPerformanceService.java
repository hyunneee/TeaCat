package com.teacat.server.performance.service;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.config.PerformanceImageProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.performance.dto.request.ConcertCreateRequest;
import com.teacat.server.performance.dto.request.ConcertUpdateRequest;
import com.teacat.server.performance.dto.request.PerformanceAreaSaveRequest;
import com.teacat.server.performance.dto.request.PresignedUploadRequest;
import com.teacat.server.performance.dto.request.ScheduleCreateRequest;
import com.teacat.server.performance.dto.response.ConcertCreateResponse;
import com.teacat.server.performance.dto.response.ConcertDetailResponse;
import com.teacat.server.performance.dto.response.ConcertStatusResponse;
import com.teacat.server.performance.dto.response.ConcertSummaryResponse;
import com.teacat.server.performance.dto.response.ConcertVisibilityResponse;
import com.teacat.server.performance.dto.response.PerformanceAreaResponse;
import com.teacat.server.performance.dto.response.PresignedUploadResponse;
import com.teacat.server.performance.dto.response.ScheduleCreateResponse;
import com.teacat.server.performance.dto.response.ScheduleSummaryResponse;
import com.teacat.server.performance.entity.BookingOpenStatus;
import com.teacat.server.performance.entity.PerformanceArea;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.entity.PerformanceStatus;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceAreaRepository;
import com.teacat.server.ticket.repository.TicketRepository;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.performance.repository.PerformanceGeneralRepository;
import com.teacat.server.stadium.entity.Area;
import com.teacat.server.stadium.entity.AreaType;
import com.teacat.server.stadium.entity.Stadium;
import com.teacat.server.stadium.repository.AreaRepository;
import com.teacat.server.stadium.repository.StadiumRepository;
import com.teacat.server.stadium.repository.StadiumLayoutRepository;
import com.teacat.server.stadium.entity.StadiumLayout;
import com.teacat.server.stadium.entity.StadiumLayoutStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.OptionalLong;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 공연 관리 (API-261 ~ 265, 268, 270, 271).
 *
 * 이미지는 MinIO 에 올리고 DB 에는 key 만 남긴다.
 *
 * 등록(261)과 업로드 URL 발급(270)을 뺀 모든 API 는 <b>다룰 수 있는 공연</b>만 대상으로 한다.
 * <pre>
 *   ADMIN        모든 공연        전체 관리자
 *   PERFORMANCE  자기가 등록한 것  주최자 여럿이 각자 공연을 올리므로 남의 공연을 건드리면 안 된다
 * </pre>
 * 판정은 {@link #getManageablePerformance} 한 곳에 있다.
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
    private final PerformanceAreaRepository performanceAreaRepository;
    private final AreaRepository areaRepository;
    private final TicketRepository ticketRepository;
    private final ScheduleSeatAvailability seatAvailability;
    private final StadiumRepository stadiumRepository;
    private final StadiumLayoutRepository stadiumLayoutRepository;
    private final FileStorageService fileStorageService;
    private final PerformanceImageProperties imageProperties;

    /** 공연 등록 (API-261) */
    @Transactional
    public ConcertCreateResponse create(ConcertCreateRequest request, Long userId) {
        Stadium stadium = getStadium(request.stadiumId());

        if (request.visibleFrom().isAfter(request.ticketingStartAt().toLocalDate())) {
            throw new BusinessException(PerformanceErrorCode.INVALID_VISIBLE_FROM);
        }

        // 회차 검사는 이미지를 올리기 **전에** 한다. 여기서 거절되면 스토리지에 고아 파일이 남지 않는다
        List<LocalDateTime> performanceDates = normalizePerformanceDates(
                request.performanceDatesOrEmpty(), request.ticketingStartAt());

        StadiumLayout stadiumLayout = resolveLayout(stadium, request.stadiumLayoutId());

        String posterKey = uploadIfPresent(request.poster(), POSTER_DIRECTORY, imageProperties.posterMaxSize());
        String detailImageKey = uploadIfPresent(
                request.detailImage(), DETAIL_IMAGE_DIRECTORY, imageProperties.detailMaxSize());

        PerformanceGeneral performance = performanceGeneralRepository.save(
                PerformanceGeneral.create(
                        stadium,
                        stadiumLayout,
                        request.title(),
                        request.ticketingStartAt(),
                        request.visibleFrom(),
                        posterKey,
                        detailImageKey,
                        userId));

        // 회차 번호는 일시 순으로 1 부터. 관리자가 순서를 섞어 보내도 1회차가 가장 빠른 공연이다
        List<PerformanceDetail> details = new ArrayList<>();
        for (int i = 0; i < performanceDates.size(); i++) {
            details.add(PerformanceDetail.create(performance, i + 1, performanceDates.get(i)));
        }
        performanceDetailRepository.saveAll(details);

        return ConcertCreateResponse.of(performance.getId(), details.size());
    }

    /**
     * 함께 등록할 회차 일시를 정리한다 — 일시 순 정렬, 중복 거절, 티켓팅 시작 이전 거절.
     * 회차 등록(API-265)과 같은 규칙이다. 한 요청 안에서 같은 일시가 두 번 오면 실수로 본다.
     */
    private List<LocalDateTime> normalizePerformanceDates(List<LocalDateTime> dates, LocalDateTime ticketingStartAt) {
        List<LocalDateTime> sorted = dates.stream().sorted().toList();

        if (sorted.size() != Set.copyOf(sorted).size()) {
            throw new BusinessException(PerformanceErrorCode.DUPLICATE_PERFORMANCE_DATE);
        }
        if (!sorted.isEmpty() && sorted.getFirst().isBefore(ticketingStartAt)) {
            throw new BusinessException(PerformanceErrorCode.INVALID_PERFORMANCE_DATE);
        }

        return sorted;
    }

    /**
     * 공연 수정 (API-262).
     *
     * 티켓팅이 시작된 뒤에는 제목만 바꿀 수 있다.
     * 공연장·티켓팅 시각·노출 시작일은 예매자가 이미 보고 결정한 정보라 뒤늦게 바꾸면 안 된다.
     */
    @Transactional
    public void update(Long concertId, ConcertUpdateRequest request, AuthUser actor) {
        if (request.isEmpty()) {
            throw new BusinessException(PerformanceErrorCode.NOTHING_TO_UPDATE);
        }

        PerformanceGeneral performance = getManageablePerformance(concertId, actor);

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

        StadiumLayout defaultLayout = null;
        if (stadium != null) {
            defaultLayout = stadiumLayoutRepository.findDefaultByStadiumId(stadium.getId())
                    .orElseThrow(() -> new BusinessException(PerformanceErrorCode.STADIUM_LAYOUT_NOT_FOUND));
        }

        performance.update(request.title(), stadium, request.ticketingStartAt(), request.visibleFrom());
        if (defaultLayout != null) {
            performance.updateLayout(defaultLayout, java.util.List.of(), java.util.List.of());
        }

        replaceImagesIfPresent(performance, request.posterImageKey(), request.detailImageKey());
    }

    /**
     * 업로드 URL 발급(API-270)으로 올린 이미지로 교체한다.
     *
     * key 는 클라이언트가 보내는 값이라 그대로 믿지 않는다.
     * 정해진 경로로 시작하는지, 실제로 파일이 올라와 있는지, 용량 한도 안인지 확인한 뒤 바꾼다.
     */
    private void replaceImagesIfPresent(PerformanceGeneral performance, String posterKey, String detailKey) {
        String oldPoster = performance.getPosterImageKey();
        String oldDetail = performance.getDetailImageKey();

        if (posterKey != null) {
            validateUploadedKey(posterKey, POSTER_DIRECTORY, imageProperties.posterMaxSize());
        }
        if (detailKey != null) {
            validateUploadedKey(detailKey, DETAIL_IMAGE_DIRECTORY, imageProperties.detailMaxSize());
        }

        performance.replaceImages(posterKey, detailKey);

        // 교체가 끝난 뒤에 옛 파일을 지운다. 실패해도 요청을 되돌리지 않는다
        if (posterKey != null && !posterKey.equals(oldPoster)) {
            deleteQuietly(oldPoster);
        }
        if (detailKey != null && !detailKey.equals(oldDetail)) {
            deleteQuietly(oldDetail);
        }
    }

    /**
     * 업로드 URL 로 올린 파일은 서버를 거치지 않아 올리는 순간에는 용량을 볼 수 없다.
     * 그래서 key 를 넘겨받는 지금 실제 크기를 확인한다.
     *
     * 한도를 넘으면 그 파일을 지우고 거절한다. 남겨두면 아무 공연에도 연결되지 않은
     * 큰 파일이 스토리지를 차지한 채 영원히 남기 때문이다.
     */
    private void validateUploadedKey(String key, String expectedDirectory, DataSize maxSize) {
        if (!key.startsWith(expectedDirectory + "/")) {
            throw new BusinessException(PerformanceErrorCode.IMAGE_NOT_UPLOADED);
        }

        OptionalLong size = fileStorageService.objectSize(key);

        if (size.isEmpty()) {
            throw new BusinessException(PerformanceErrorCode.IMAGE_NOT_UPLOADED);
        }
        if (size.getAsLong() > maxSize.toBytes()) {
            deleteQuietly(key);
            throw new BusinessException(PerformanceErrorCode.IMAGE_TOO_LARGE);
        }
    }

    /**
     * 공연 삭제 (API-263).
     *
     * 예매 이력이 있으면 지우지 않고 거절한다. 발권된 티켓이 어떤 공연이었는지
     * 추적할 수 없게 되기 때문이다. 그럴 때는 비공개(API-271)로 감춘다.
     *
     * 예전에는 이력이 있으면 조용히 비공개로 바꿨는데,
     * "삭제를 눌렀는데 비공개가 됐다"는 결과가 관리자에게 보이지 않아 분리했다.
     */
    @Transactional
    public void delete(Long concertId, AuthUser actor) {
        PerformanceGeneral performance = getManageablePerformance(concertId, actor);

        if (performanceGeneralRepository.existsTicketByPerformanceId(concertId)) {
            throw new BusinessException(PerformanceErrorCode.PERFORMANCE_HAS_TICKETS);
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
     * 회차 번호를 생략하면 등록 뒤 그 공연의 회차 번호를 **일시 순으로 다시 매긴다**.
     * 번호를 직접 지정하면 그대로 쓰되, (performance_general_id, performance_num) UNIQUE 에 걸리는 중복은 미리 막는다.
     */
    @Transactional
    public ScheduleCreateResponse createSchedule(Long concertId, ScheduleCreateRequest request, AuthUser actor) {
        PerformanceGeneral performance = getManageablePerformance(concertId, actor);

        // 티켓팅 시작일보다 앞선 공연일은 예매가 불가능한 회차가 된다
        if (request.performanceDate().isBefore(performance.getTicketingStartAt())) {
            throw new BusinessException(PerformanceErrorCode.INVALID_PERFORMANCE_DATE);
        }

        // 번호를 직접 지정하면 그대로 쓴다. 관리자가 의도한 번호 체계가 있다는 뜻이라 건드리지 않는다
        if (request.performanceNum() != null) {
            if (performanceDetailRepository.existsByPerformanceIdAndPerformanceNum(
                    concertId, request.performanceNum())) {
                throw new BusinessException(PerformanceErrorCode.DUPLICATE_SCHEDULE_NUM);
            }

            PerformanceDetail detail = performanceDetailRepository.save(
                    PerformanceDetail.create(performance, request.performanceNum(), request.performanceDate()));

            return ScheduleCreateResponse.of(detail.getId(), detail.getPerformanceNum());
        }

        // 번호를 생략하면 일시 순으로 전체를 다시 매긴다 — 나중에 더 이른 날짜를 추가해도 1회차가 가장 빠른 공연이다.
        // 저장할 때의 번호는 UNIQUE 를 피하기 위한 임시값(마지막 + 1)일 뿐이다
        PerformanceDetail detail = performanceDetailRepository.save(PerformanceDetail.create(
                performance,
                performanceDetailRepository.findMaxPerformanceNum(concertId) + 1,
                request.performanceDate()));

        renumberSchedulesByDate(concertId);

        return ScheduleCreateResponse.of(
                detail.getId(), performanceDetailRepository.findPerformanceNumById(detail.getId()));
    }

    /**
     * 회차 번호를 공연 일시 순으로 1 부터 다시 매긴다.
     * 두 단계(음수로 비켜두기 → 재부여)인 이유는 repository 주석 참고.
     */
    private void renumberSchedulesByDate(Long concertId) {
        performanceDetailRepository.negatePerformanceNums(concertId);
        performanceDetailRepository.renumberByDate(concertId);
    }

    /**
     * 관리 대상 공연 목록 — 비공개 포함.
     *
     * 클라이언트 목록(API-201)은 비공개를 숨기므로, 비공개로 돌린 공연을 되돌릴 입구가 여기다.
     *
     * <pre>
     *   ADMIN        모든 공연        수정·삭제 권한과 목록이 같아야 남의 공연을 찾아갈 수 있다
     *   PERFORMANCE  자기가 등록한 것
     * </pre>
     */
    public List<ConcertSummaryResponse> getMyConcerts(AuthUser actor) {
        List<PerformanceGeneral> performances = actor.isAdmin()
                ? performanceGeneralRepository.findAllForAdmin()
                : performanceGeneralRepository.findAllByCreatedById(actor.id());

        if (performances.isEmpty()) {
            return List.of();
        }

        LocalDateTime now = LocalDateTime.now();

        // 회차는 한 번에 읽어 나눈다. 공연마다 따로 읽으면 목록 크기만큼 쿼리가 늘어난다
        Map<Long, List<PerformanceDetail>> schedulesByConcert =
                performanceDetailRepository.findByPerformanceIdIn(
                                performances.stream().map(PerformanceGeneral::getId).toList())
                        .stream()
                        .collect(Collectors.groupingBy(detail -> detail.getPerformance().getId()));

        return performances.stream()
                .map(p -> ConcertSummaryResponse.of(
                        p,
                        fileStorageService.presignedUrl(p.getPosterImageKey()),
                        BookingOpenStatus.aggregate(
                                schedulesByConcert.getOrDefault(p.getId(), List.of()).stream()
                                        .map(detail -> detail.bookingStatus(now))
                                        .toList(),
                                p.getTicketingStartAt(),
                                now)))
                .toList();
    }

    /**
     * 관리용 공연 상세 — 비공개여도 준다.
     * 수정 화면이 클라이언트 상세(API-202)를 쓰면 비공개 공연은 404 라 수정할 수 없어서 따로 둔다.
     */
    public ConcertDetailResponse getMyConcert(Long concertId, AuthUser actor) {
        PerformanceGeneral performance = getManageablePerformance(concertId, actor);
        LocalDateTime now = LocalDateTime.now();

        List<PerformanceDetail> details =
                performanceDetailRepository.findByPerformanceIdOrderByPerformanceNumAsc(concertId);

        // 관리 화면도 같은 기준으로 매진을 봐야 한다 — 다르면 운영자와 관람객이 다른 상태를 본다
        Set<Long> soldOut = seatAvailability.findSoldOut(
                details.stream().map(PerformanceDetail::getId).toList());

        List<ScheduleSummaryResponse> schedules = details.stream()
                .map(detail -> ScheduleSummaryResponse.of(detail, now, soldOut.contains(detail.getId())))
                .toList();

        // 판매량은 티켓에서 센다. 수정 화면이 이 값으로 "이미 판 구역" 을 잠그므로 정확해야 한다
        // (saveAreas 와 같은 방식이다)
        Map<Long, Long> soldByArea = ticketRepository.countSoldByArea(concertId).stream()
                .collect(Collectors.toMap(
                        TicketRepository.AreaSoldCount::getAreaId,
                        TicketRepository.AreaSoldCount::getSoldCount));

        List<PerformanceAreaResponse> areas = performanceAreaRepository.findAllByPerformanceId(concertId).stream()
                .map(pa -> PerformanceAreaResponse.of(
                        pa, soldByArea.getOrDefault(pa.getArea().getId(), 0L)))
                .toList();

        return ConcertDetailResponse.of(
                performance,
                schedules,
                areas,
                fileStorageService.presignedUrl(performance.getPosterImageKey()),
                fileStorageService.presignedUrl(performance.getDetailImageKey()));
    }

    /**
     * 공연 상태 전환 (API-264).
     *
     * 전이 규칙은 {@link PerformanceStatus#canTransitionTo} 에 있다.
     * 같은 상태로 바꾸는 요청도 거절한다 — 관리자가 화면을 새로 고치지 않고 두 번 눌렀을 가능성이 높고,
     * 조용히 200 을 주면 그 사실을 알 수 없다.
     *
     * 취소(CANCELLED)는 공연 상태만 바꾼다. 이미 발권된 티켓의 환불·무효화는
     * 예매·티켓 도메인의 일이라 여기서 건드리지 않는다.
     */
    @Transactional
    public ConcertStatusResponse changeStatus(Long concertId, PerformanceStatus target, AuthUser actor) {
        PerformanceGeneral performance = getManageablePerformance(concertId, actor);
        PerformanceStatus current = performance.getStatus();

        if (!current.canTransitionTo(target)) {
            throw new BusinessException(PerformanceErrorCode.INVALID_STATUS_TRANSITION);
        }

        performance.changeStatus(target);

        return ConcertStatusResponse.of(performance, current);
    }

    /**
     * 공연 공개 · 비공개 전환 (API-271).
     *
     * 예매 이력과 무관하게 관리자가 직접 고른다.
     * 등록만 해두고 아직 공개하지 않거나, 정보가 틀려 잠깐 내리는 경우가 있다.
     *
     * 비공개는 목록·상세에서 감출 뿐 데이터를 지우지 않아 언제든 되돌릴 수 있다.
     */
    @Transactional
    public ConcertVisibilityResponse setVisibility(Long concertId, boolean visible, AuthUser actor) {
        PerformanceGeneral performance = getManageablePerformance(concertId, actor);

        if (visible) {
            performance.show();
        } else {
            performance.hide(LocalDateTime.now());
        }

        return ConcertVisibilityResponse.from(performance);
    }

    /**
     * 공연 구역 등급·가격 일괄 저장 (API-268).
     *
     * PUT 이라 보낸 목록이 전체가 된다. 빠진 구역은 판매하지 않는다는 뜻이므로 지운다.
     * 이미 팔린 구역을 빼거나 판매량보다 적게 줄이는 것은 막는다 — DB CHECK 에 걸리기 전에 걸러낸다.
     */
    @Transactional
    public List<PerformanceAreaResponse> saveAreas(Long concertId, PerformanceAreaSaveRequest request,
                                                   AuthUser actor) {
        PerformanceGeneral performance = getManageablePerformance(concertId, actor);

        List<Long> requestedAreaIds = request.areas().stream()
                .map(PerformanceAreaSaveRequest.AreaSetting::areaId)
                .toList();

        if (requestedAreaIds.size() != Set.copyOf(requestedAreaIds).size()) {
            throw new BusinessException(PerformanceErrorCode.DUPLICATE_AREA);
        }

        // 남의 공연장 구역을 붙이면 배치도와 좌석이 어긋난다
        Map<Long, Area> stadiumAreas = areaRepository
                .findAllByStadiumLayoutIdOrderByLevelCodeAscAreaCodeAsc(performance.getStadiumLayout().getId())
                .stream()
                .collect(Collectors.toMap(Area::getId, Function.identity()));

        if (!stadiumAreas.keySet().containsAll(requestedAreaIds)) {
            throw new BusinessException(PerformanceErrorCode.AREA_NOT_IN_STADIUM);
        }

        Map<Long, PerformanceArea> existing = performanceAreaRepository.findAllByPerformanceId(concertId).stream()
                .collect(Collectors.toMap(pa -> pa.getArea().getId(), Function.identity()));

        // 판매량은 티켓에서 센다. sold_cnt 컬럼이 있던 시절에는 그 값을 아무도 갱신하지 않아
        // 늘 0 이었고, 그래서 아래 두 검사가 통과만 하고 있었다
        Map<Long, Long> soldByArea = ticketRepository.countSoldByArea(concertId).stream()
                .collect(Collectors.toMap(
                        TicketRepository.AreaSoldCount::getAreaId,
                        TicketRepository.AreaSoldCount::getSoldCount));

        for (PerformanceAreaSaveRequest.AreaSetting setting : request.areas()) {
            PerformanceArea current = existing.get(setting.areaId());
            long sold = soldByArea.getOrDefault(setting.areaId(), 0L);

            if (current != null && current.wouldBreakSoldCount(setting.maxCnt(), sold)) {
                throw new BusinessException(PerformanceErrorCode.AREA_MAX_CNT_BELOW_SOLD);
            }

            // 판 뒤에 방식을 바꾸면 이미 나간 티켓의 근거가 어긋난다.
            // 좌석제로 팔린 티켓은 좌석을 가리키는데 스탠딩으로 바꾸면 그 좌석이 사라진다
            if (current != null && sold > 0 && setting.saleType() != null
                    && current.getSaleType() != setting.saleType()) {
                throw new BusinessException(PerformanceErrorCode.AREA_SALE_TYPE_LOCKED);
            }

            AreaType saleType = resolveSaleType(setting, stadiumAreas.get(setting.areaId()), current);

            // 스탠딩은 max_cnt 가 인원을 제한하는 **유일한** 값이다.
            // 좌석제는 좌석 행 수가 곧 상한이라 비어 있어도 되지만, 스탠딩에서 비우면 무제한이 된다
            if (saleType == AreaType.STANDING && (setting.maxCnt() == null || setting.maxCnt() < 1)) {
                throw new BusinessException(PerformanceErrorCode.AREA_MAX_CNT_REQUIRED);
            }
            if (saleType == AreaType.STANDING
                    && setting.maxCnt() > stadiumAreas.get(setting.areaId()).getMaxSeat()) {
                throw new BusinessException(PerformanceErrorCode.AREA_MAX_CNT_EXCEEDED);
            }
        }

        // 판매 이력이 있는 구역을 빼면 그 티켓의 가격·등급 근거가 사라진다
        boolean removesSoldArea = existing.values().stream()
                .anyMatch(pa -> soldByArea.getOrDefault(pa.getArea().getId(), 0L) > 0
                        && !requestedAreaIds.contains(pa.getArea().getId()));

        if (removesSoldArea) {
            throw new BusinessException(PerformanceErrorCode.AREA_MAX_CNT_BELOW_SOLD);
        }

        performanceAreaRepository.deleteByPerformanceIdAndAreaIdNotIn(concertId, requestedAreaIds);

        List<PerformanceArea> saved = request.areas().stream()
                .map(setting -> {
                    Area area = stadiumAreas.get(setting.areaId());
                    PerformanceArea current = existing.get(setting.areaId());
                    AreaType saleType = resolveSaleType(setting, area, current);

                    if (current != null) {
                        current.updateSetting(setting.grade(), setting.price(), setting.maxCnt(), saleType);
                        return current;
                    }

                    return PerformanceArea.create(
                            performance, area, setting.grade(), setting.price(), setting.maxCnt(), saleType);
                })
                .toList();

        return performanceAreaRepository.saveAll(saved).stream()
                .map(pa -> PerformanceAreaResponse.of(
                        pa, soldByArea.getOrDefault(pa.getArea().getId(), 0L)))
                .toList();
    }

    /**
     * 이 공연이 쓸 무대 형식(배치)을 정한다.
     *
     * 한 공연장이 무대를 U형·O형처럼 바꿀 수 있고 형식마다 구역이 다르게 나뉜다.
     * 그 형식들은 stadium_layouts 에 미리 저장돼 있고, 공연은 그중 하나를 골라 쓴다.
     * 고른 형식이 이 공연에서 팔 수 있는 구역의 범위가 된다 (saveAreas 가 이 기준으로 검증한다).
     *
     * 생략하면 공연장의 기본 배치를 쓴다 — 형식을 신경 쓰지 않는 기존 호출과 같게 동작한다.
     * DRAFT·ARCHIVED 배치는 고를 수 없다. 아직 만들던 중이거나 더 쓰지 않기로 한 형식이다.
     */
    private StadiumLayout resolveLayout(Stadium stadium, Long stadiumLayoutId) {
        if (stadiumLayoutId == null) {
            return stadiumLayoutRepository.findDefaultByStadiumId(stadium.getId())
                    .orElseThrow(() -> new BusinessException(PerformanceErrorCode.STADIUM_LAYOUT_NOT_FOUND));
        }

        StadiumLayout layout = stadiumLayoutRepository.findById(stadiumLayoutId)
                .orElseThrow(() -> new BusinessException(PerformanceErrorCode.STADIUM_LAYOUT_NOT_FOUND));

        if (!layout.getStadium().getId().equals(stadium.getId())) {
            throw new BusinessException(PerformanceErrorCode.PERFORMANCE_LAYOUT_MISMATCH);
        }
        if (layout.getStatus() != StadiumLayoutStatus.ACTIVE) {
            throw new BusinessException(PerformanceErrorCode.STADIUM_LAYOUT_NOT_ACTIVE);
        }

        return layout;
    }

    /**
     * 이 공연에서 구역을 파는 방식을 정한다 (API-268).
     *
     * 생략하면 **이미 저장된 방식을 그대로 둔다**. 새 구역이면 공연장 구역의 형태를 따른다.
     * 생략을 "공연장 형태로 되돌리기" 로 해석하면, 방식을 신경 쓰지 않는 옛 클라이언트가
     * 바꿔 둔 방식을 저장할 때마다 되돌려 버린다.
     *
     * 공연장 배치 유형과 판매 유형은 일치해야 한다. 스탠딩의 seats 행은 좌석 배치가 아니라
     * 입장권마다 안정적인 seatId를 주기 위한 가상 재고이므로 좌석제로 전환할 근거가 아니다.
     */
    private AreaType resolveSaleType(PerformanceAreaSaveRequest.AreaSetting setting, Area area,
                                     PerformanceArea current) {
        if (setting.saleType() == null) {
            return current != null ? current.getSaleType() : area.getType();
        }
        if (setting.saleType() != area.getType()) {
            throw new BusinessException(PerformanceErrorCode.AREA_SALE_TYPE_NOT_ALLOWED);
        }
        return setting.saleType();
    }

    /**
     * 이미지 업로드 URL 발급 (API-270).
     *
     * 파일 바이트가 서버를 거치지 않고 클라이언트에서 MinIO 로 직접 간다.
     * 큰 이미지가 서버 메모리와 대역폭을 잡아먹지 않게 하기 위함이다.
     */
    public PresignedUploadResponse issueUploadUrl(PresignedUploadRequest request) {
        boolean poster = request.imageType() == PresignedUploadRequest.ImageType.POSTER;
        String directory = poster ? POSTER_DIRECTORY : DETAIL_IMAGE_DIRECTORY;
        DataSize maxSize = poster ? imageProperties.posterMaxSize() : imageProperties.detailMaxSize();

        // 한도를 함께 내려줘야 클라이언트가 올리기 전에 걸러 줄 수 있다. 올린 뒤 거절되면 대역폭만 낭비다
        return PresignedUploadResponse.of(
                fileStorageService.presignedUploadUrl(directory, request.contentType()), maxSize);
    }

    private String uploadIfPresent(MultipartFile file, String directory, DataSize maxSize) {
        return (file == null || file.isEmpty()) ? null : fileStorageService.uploadImage(file, directory, maxSize);
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

    /**
     * 이 사람이 다룰 수 있는 공연을 가져온다.
     *
     * <pre>
     *   ADMIN        모든 공연        전체 관리자라 남이 등록한 공연도 고칠 수 있다
     *   PERFORMANCE  자기가 등록한 것  공연 주최자끼리 남의 공연을 건드리면 안 된다
     * </pre>
     *
     * 남의 공연은 "없는 공연"(404)이 아니라 "권한 없음"(403)으로 알려준다.
     * 관리자끼리는 공연이 존재한다는 사실을 감출 이유가 없고, 404 를 주면 ID 를 잘못 넣었다고 오해한다.
     */
    private PerformanceGeneral getManageablePerformance(Long concertId, AuthUser actor) {
        PerformanceGeneral performance = performanceGeneralRepository.findById(concertId)
                .orElseThrow(() -> new BusinessException(PerformanceErrorCode.PERFORMANCE_NOT_FOUND));

        if (!actor.isAdmin() && !performance.isOwnedBy(actor.id())) {
            throw new BusinessException(PerformanceErrorCode.NOT_OWNER);
        }

        return performance;
    }

    private Stadium getStadium(Long stadiumId) {
        return stadiumRepository.findById(stadiumId)
                .orElseThrow(() -> new BusinessException(PerformanceErrorCode.STADIUM_NOT_FOUND));
    }
}
