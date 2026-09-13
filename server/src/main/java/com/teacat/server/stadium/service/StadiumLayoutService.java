package com.teacat.server.stadium.service;

import com.teacat.server.auth.exception.AuthErrorCode;
import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.stadium.dto.request.LayoutImportAreaRequest;
import com.teacat.server.stadium.dto.request.SeatCreateRequest;
import com.teacat.server.stadium.dto.request.SeatLabelingRuleRequest;
import com.teacat.server.stadium.dto.request.StadiumLayoutCreateRequest;
import com.teacat.server.stadium.dto.request.StadiumLayoutCopyRequest;
import com.teacat.server.stadium.dto.request.StadiumLayoutUpdateRequest;
import com.teacat.server.stadium.dto.response.AreaListResponse;
import com.teacat.server.stadium.dto.response.AreaSummaryResponse;
import com.teacat.server.stadium.dto.response.CreatedLayoutAreaResponse;
import com.teacat.server.stadium.dto.response.CreatedSeatResponse;
import com.teacat.server.stadium.dto.response.ExcelAnalysisResponse;
import com.teacat.server.stadium.dto.response.ExcelCandidateResponse;
import com.teacat.server.stadium.dto.response.SeatResponse;
import com.teacat.server.stadium.dto.response.StadiumLayoutCreateResponse;
import com.teacat.server.stadium.dto.response.StadiumLayoutDetailResponse;
import com.teacat.server.stadium.dto.response.StadiumLayoutListResponse;
import com.teacat.server.stadium.dto.response.StadiumLayoutSummaryResponse;
import com.teacat.server.stadium.entity.Area;
import com.teacat.server.stadium.entity.AreaType;
import com.teacat.server.stadium.entity.Seat;
import com.teacat.server.stadium.entity.Stadium;
import com.teacat.server.stadium.entity.StadiumLayout;
import com.teacat.server.stadium.entity.StadiumLayoutStatus;
import com.teacat.server.stadium.exception.StadiumErrorCode;
import com.teacat.server.stadium.repository.AreaRepository;
import com.teacat.server.stadium.repository.ExcelLayoutAnalysisRepository;
import com.teacat.server.stadium.repository.SeatBatchRepository;
import com.teacat.server.stadium.repository.SeatRepository;
import com.teacat.server.stadium.repository.StadiumLayoutRepository;
import com.teacat.server.stadium.repository.StadiumRepository;
import com.teacat.server.user.entity.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StadiumLayoutService {

    private static final Duration ANALYSIS_TTL = Duration.ofMinutes(30);

    private final StadiumRepository stadiumRepository;
    private final StadiumLayoutRepository layoutRepository;
    private final AreaRepository areaRepository;
    private final SeatRepository seatRepository;
    private final SeatBatchRepository seatBatchRepository;
    private final ExcelLayoutAnalysisRepository analysisRepository;
    private final ExcelLayoutParser excelLayoutParser;
    private final FileStorageService fileStorageService;

    public StadiumLayoutListResponse getLayouts(Long stadiumId) {
        ensureStadium(stadiumId);
        List<StadiumLayoutSummaryResponse> layouts = layoutRepository
                .findAllByStadiumIdOrderByDefaultLayoutDescCreatedAtAsc(stadiumId).stream()
                .map(this::toLayoutSummary)
                .toList();
        return new StadiumLayoutListResponse(stadiumId, layouts);
    }

    public StadiumLayoutDetailResponse getLayout(Long layoutId) {
        StadiumLayout layout = getLayoutEntity(layoutId);
        LayoutCapacity capacity = getLayoutCapacity(layoutId);
        return new StadiumLayoutDetailResponse(
                layout.getId(), layout.getStadium().getId(), layout.getStadium().getName(), layout.getName(),
                layout.isDefaultLayout(), layout.getStatus(), fileStorageService.presignedUrl(layout.getImageKey()),
                layout.getWidth(), layout.getHeight(), layout.getLayoutElements(),
                areaRepository.countByStadiumLayoutId(layoutId), capacity.seated(), capacity.standing(),
                capacity.total());
    }

    public AreaListResponse getAreas(Long layoutId) {
        StadiumLayout layout = getLayoutEntity(layoutId);
        List<AreaSummaryResponse> areas = areaRepository.findAllWithStatsByLayoutId(layoutId).stream()
                .map(area -> new AreaSummaryResponse(area.getAreaId(), area.getLevelCode(), area.getAreaCode(),
                        AreaType.valueOf(area.getType()), area.getMaxSeat(), area.getSeatCount(),
                        area.getAreaX(), area.getAreaY(), area.getWidth(), area.getHeight()))
                .toList();
        return new AreaListResponse(layout.getStadium().getId(), areas);
    }

    @Transactional
    public ExcelAnalysisResponse analyzeExcel(Long stadiumId, AuthUser authUser, MultipartFile file) {
        Stadium stadium = getStadium(stadiumId);
        ensureCanManage(stadium, authUser);
        ExcelLayoutParser.ParsedExcel parsed = excelLayoutParser.parse(file);
        ExcelAnalysisResponse response = new ExcelAnalysisResponse(
                UUID.randomUUID().toString(), stadiumId, Math.toIntExact(ANALYSIS_TTL.toSeconds()),
                parsed.sheets(), parsed.seatCandidates(), parsed.elementCandidates(), parsed.warnings());
        analysisRepository.save(response, ANALYSIS_TTL);
        return response;
    }

    @Transactional
    public StadiumLayoutCreateResponse createFromExcel(
            Long stadiumId, AuthUser authUser, StadiumLayoutCreateRequest request) {
        Stadium stadium = getStadium(stadiumId);
        ensureCanManage(stadium, authUser);
        if (layoutRepository.existsByStadiumIdAndName(stadiumId, request.name())) {
            throw new BusinessException(StadiumErrorCode.DUPLICATE_LAYOUT_NAME);
        }
        Map<String, ExcelCandidateResponse> candidates = new HashMap<>();
        if (request.hasAnalysis()) {
            ExcelAnalysisResponse analysis = analysisRepository.find(request.analysisId())
                    .filter(saved -> saved.stadiumId().equals(stadiumId))
                    .orElseThrow(() -> new BusinessException(StadiumErrorCode.EXCEL_ANALYSIS_NOT_FOUND));
            analysis.seatCandidates()
                    .forEach(candidate -> candidates.put(candidate.candidateId(), candidate));
        }
        if (candidates.isEmpty() && request.areas().stream().anyMatch(area -> !area.candidateIdsOrEmpty().isEmpty())) {
            throw new BusinessException(StadiumErrorCode.INVALID_EXCEL_MAPPING);
        }
        validateLayoutElements(request.layoutElementsOrEmpty(), request.layoutWidth(), request.layoutHeight());

        StadiumLayoutStatus status = request.saveMode().toStatus();
        if (status != StadiumLayoutStatus.ACTIVE && request.isDefault()) {
            throw new BusinessException(StadiumErrorCode.DRAFT_LAYOUT_CANNOT_BE_DEFAULT);
        }
        boolean makeDefault = status == StadiumLayoutStatus.ACTIVE
                && (request.isDefault() || layoutRepository.findDefaultByStadiumId(stadiumId).isEmpty());
        if (makeDefault) clearDefault(stadiumId);
        StadiumLayout layout;
        try {
            layout = layoutRepository.saveAndFlush(StadiumLayout.create(
                    stadium, request.name(), request.layoutWidth(), request.layoutHeight(),
                    request.layoutElementsOrEmpty(), makeDefault, status));
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(StadiumErrorCode.DUPLICATE_LAYOUT_NAME);
        }

        Set<String> usedCandidates = new HashSet<>();
        Set<String> areaCodes = new HashSet<>();
        List<CreatedLayoutAreaResponse> createdAreas = new ArrayList<>();
        int seatCount = 0;
        long layoutCapacity = 0;
        for (LayoutImportAreaRequest areaRequest : request.areas()) {
            if (!areaCodes.add(areaRequest.levelCodeOrDefault() + '#' + areaRequest.areaCode())) {
                throw new BusinessException(StadiumErrorCode.DUPLICATE_AREA_CODE);
            }
            validateBounds(areaRequest, request.layoutWidth(), request.layoutHeight());
            List<LabeledSeat> seats = buildSeats(
                    areaRequest, request.sourceSheetOrEmpty(), candidates, usedCandidates);
            if (areaRequest.type() == AreaType.STANDING && !seats.isEmpty()) {
                throw new BusinessException(StadiumErrorCode.STANDING_AREA_HAS_SEATS);
            }
            int maxSeat = areaRequest.type() == AreaType.SEATED
                    ? seats.size() : (areaRequest.maxSeat() == null ? 0 : areaRequest.maxSeat());
            if (maxSeat <= 0) throw new BusinessException(StadiumErrorCode.INVALID_EXCEL_MAPPING);
            if (areaRequest.type() == AreaType.STANDING) {
                seats = buildStandingInventory(maxSeat);
            }
            layoutCapacity += maxSeat;
            validateLayoutCapacity(stadium, layoutCapacity);

            Area area = areaRepository.saveAndFlush(Area.create(
                    stadium, layout, areaRequest.levelCodeOrDefault(),
                    areaRequest.areaCode(), areaRequest.type(), maxSeat,
                    areaRequest.bounds().x(), areaRequest.bounds().y(), areaRequest.bounds().height(),
                    areaRequest.bounds().width()));
            seatBatchRepository.insertAll(seats.stream()
                    .map(seat -> new SeatBatchRepository.SeatBatchRow(
                            area.getId(), seat.x(), seat.y(), seat.rowLabel(), seat.seatNumber()))
                    .toList());

            Map<String, String> candidateByLabel = new HashMap<>();
            seats.forEach(seat -> candidateByLabel.put(seat.rowLabel() + "#" + seat.seatNumber(), seat.candidateId()));
            List<CreatedSeatResponse> createdSeats = seatRepository
                    .findAllByAreaIdOrderByRowLabelAscSeatNumberAsc(area.getId()).stream()
                    .map(seat -> new CreatedSeatResponse(seat.getId(), seat.getRowLabel(), seat.getSeatNumber(),
                            candidateByLabel.get(seat.getRowLabel() + "#" + seat.getSeatNumber())))
                    .toList();
            createdAreas.add(new CreatedLayoutAreaResponse(area.getId(), area.getAreaCode(), createdSeats));
            seatCount += createdSeats.size();
        }
        if (request.hasAnalysis()) {
            analysisRepository.delete(request.analysisId());
        }
        return new StadiumLayoutCreateResponse(
                layout.getId(), stadiumId, createdAreas.size(), seatCount, createdAreas);
    }

    @Transactional
    public StadiumLayoutCreateResponse copyLayout(
            Long sourceLayoutId, AuthUser authUser, StadiumLayoutCopyRequest request) {
        StadiumLayout source = getLayoutEntity(sourceLayoutId);
        Stadium stadium = source.getStadium();
        ensureCanManage(stadium, authUser);
        if (layoutRepository.existsByStadiumIdAndName(stadium.getId(), request.name())) {
            throw new BusinessException(StadiumErrorCode.DUPLICATE_LAYOUT_NAME);
        }

        StadiumLayoutStatus status = request.saveMode().toStatus();
        if (status != StadiumLayoutStatus.ACTIVE && request.isDefault()) {
            throw new BusinessException(StadiumErrorCode.DRAFT_LAYOUT_CANNOT_BE_DEFAULT);
        }
        LayoutCapacity sourceCapacity = getLayoutCapacity(sourceLayoutId);
        validateLayoutCapacity(stadium, sourceCapacity.total());
        boolean makeDefault = status == StadiumLayoutStatus.ACTIVE
                && (request.isDefault() || layoutRepository.findDefaultByStadiumId(stadium.getId()).isEmpty());
        if (makeDefault) clearDefault(stadium.getId());
        StadiumLayout copied;
        try {
            copied = layoutRepository.saveAndFlush(StadiumLayout.create(
                    stadium, request.name(), source.getWidth(), source.getHeight(),
                    source.getLayoutElements(), makeDefault, status));
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(StadiumErrorCode.DUPLICATE_LAYOUT_NAME);
        }
        if (source.getImageKey() != null) {
            copied.updateImage(source.getImageKey(), source.getWidth(), source.getHeight());
        }

        List<CreatedLayoutAreaResponse> createdAreas = new ArrayList<>();
        int createdSeatCount = 0;
        for (Area sourceArea : areaRepository
                .findAllByStadiumLayoutIdOrderByLevelCodeAscAreaCodeAsc(sourceLayoutId)) {
            Area copiedArea = areaRepository.saveAndFlush(Area.create(
                    stadium, copied, sourceArea.getLevelCode(), sourceArea.getAreaCode(),
                    sourceArea.getType(), sourceArea.getMaxSeat(), sourceArea.getAreaX(),
                    sourceArea.getAreaY(), sourceArea.getHeight(), sourceArea.getWidth()));
            List<Seat> sourceSeats = seatRepository
                    .findAllByAreaIdOrderByRowLabelAscSeatNumberAsc(sourceArea.getId());
            seatBatchRepository.insertAll(sourceSeats.stream()
                    .map(seat -> new SeatBatchRepository.SeatBatchRow(
                            copiedArea.getId(), seat.getSeatX(), seat.getSeatY(),
                            seat.getRowLabel(), seat.getSeatNumber()))
                    .toList());
            List<CreatedSeatResponse> copiedSeats = seatRepository
                    .findAllByAreaIdOrderByRowLabelAscSeatNumberAsc(copiedArea.getId()).stream()
                    .map(seat -> new CreatedSeatResponse(
                            seat.getId(), seat.getRowLabel(), seat.getSeatNumber(), null))
                    .toList();
            createdAreas.add(new CreatedLayoutAreaResponse(
                    copiedArea.getId(), copiedArea.getAreaCode(), copiedSeats));
            createdSeatCount += copiedSeats.size();
        }
        return new StadiumLayoutCreateResponse(
                copied.getId(), stadium.getId(), createdAreas.size(), createdSeatCount, createdAreas);
    }

    @Transactional
    public void updateLayout(Long layoutId, AuthUser authUser, StadiumLayoutUpdateRequest request) {
        if (request.isEmpty()) throw new BusinessException(StadiumErrorCode.NOTHING_TO_UPDATE);
        StadiumLayout layout = getLayoutEntity(layoutId);
        ensureCanManage(layout.getStadium(), authUser);
        if (request.name() != null && !request.name().equals(layout.getName())
                && layoutRepository.existsByStadiumIdAndName(layout.getStadium().getId(), request.name())) {
            throw new BusinessException(StadiumErrorCode.DUPLICATE_LAYOUT_NAME);
        }
        if (request.layoutElements() != null) {
            validateLayoutElements(request.layoutElements(), layout.getWidth(), layout.getHeight());
        }
        StadiumLayoutStatus targetStatus = request.status() == null ? layout.getStatus() : request.status();
        boolean targetDefault = request.isDefault() == null ? layout.isDefaultLayout() : request.isDefault();
        if (targetDefault && targetStatus != StadiumLayoutStatus.ACTIVE) {
            throw new BusinessException(StadiumErrorCode.DRAFT_LAYOUT_CANNOT_BE_DEFAULT);
        }
        if (Boolean.TRUE.equals(request.isDefault())) {
            clearDefault(layout.getStadium().getId());
            layout.markDefault(true);
        } else if (Boolean.FALSE.equals(request.isDefault()) && layout.isDefaultLayout()) {
            throw new BusinessException(StadiumErrorCode.DEFAULT_LAYOUT_REQUIRED);
        }
        layout.update(request.name(), request.layoutElements(), request.status());
    }

    private StadiumLayoutSummaryResponse toLayoutSummary(StadiumLayout layout) {
        LayoutCapacity capacity = getLayoutCapacity(layout.getId());
        return new StadiumLayoutSummaryResponse(
                layout.getId(), layout.getName(), layout.isDefaultLayout(), layout.getStatus(),
                layout.getWidth(), layout.getHeight(), areaRepository.countByStadiumLayoutId(layout.getId()),
                capacity.seated(), capacity.standing(), capacity.total());
    }

    private LayoutCapacity getLayoutCapacity(Long layoutId) {
        long seated = seatRepository.countByLayoutId(layoutId);
        long standing = areaRepository.sumStandingCapacityByLayoutId(layoutId);
        return new LayoutCapacity(seated, standing);
    }

    private void validateLayoutCapacity(Stadium stadium, long layoutCapacity) {
        if (layoutCapacity > stadium.getMaxCapacity()) {
            throw new BusinessException(StadiumErrorCode.LAYOUT_CAPACITY_EXCEEDED);
        }
    }

    @Transactional
    public void deleteLayout(Long layoutId, AuthUser authUser) {
        StadiumLayout layout = getLayoutEntity(layoutId);
        ensureCanManage(layout.getStadium(), authUser);
        if (layout.isDefaultLayout()) throw new BusinessException(StadiumErrorCode.DEFAULT_LAYOUT_REQUIRED);
        if (layoutRepository.isInUse(layoutId)) throw new BusinessException(StadiumErrorCode.LAYOUT_IN_USE);
        seatRepository.deleteAllByLayoutId(layoutId);
        areaRepository.deleteAllByStadiumLayoutId(layoutId);
        layoutRepository.delete(layout);
    }

    private List<LabeledSeat> buildSeats(LayoutImportAreaRequest area, String fallbackSourceSheet,
                                         Map<String, ExcelCandidateResponse> candidates,
                                         Set<String> usedCandidates) {
        List<ExcelCandidateResponse> selected = new ArrayList<>();
        String sourceSheet = area.sourceSheetOrDefault(fallbackSourceSheet);
        for (String id : area.candidateIdsOrEmpty()) {
            ExcelCandidateResponse candidate = candidates.get(id);
            if (candidate == null || !candidate.sheet().equals(sourceSheet)
                    || !usedCandidates.add(id) || !inside(area, candidate)) {
                throw new BusinessException(StadiumErrorCode.INVALID_EXCEL_MAPPING);
            }
            selected.add(candidate);
        }

        boolean bottomToTop = area.labelingRule() != null
                && "BOTTOM_TO_TOP".equalsIgnoreCase(area.labelingRule().rowOrder());
        boolean rightToLeft = area.labelingRule() != null
                && "RIGHT_TO_LEFT".equalsIgnoreCase(area.labelingRule().seatOrder());
        selected.sort(Comparator.comparing(ExcelCandidateResponse::y)
                .thenComparing(ExcelCandidateResponse::x));
        List<List<ExcelCandidateResponse>> rows = groupRows(selected);
        if (bottomToTop) java.util.Collections.reverse(rows);
        int start = area.labelingRule() == null ? 1 : area.labelingRule().startNumberOrDefault();
        boolean hangulRows = area.labelingRule() != null
                && "HANGUL".equalsIgnoreCase(area.labelingRule().rowFormat());
        List<LabeledSeat> result = new ArrayList<>();
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            List<ExcelCandidateResponse> row = rows.get(rowIndex);
            row.sort(Comparator.comparing(ExcelCandidateResponse::x));
            if (rightToLeft) java.util.Collections.reverse(row);
            String rowLabel = rowLabel(area.labelingRule(), hangulRows, rowIndex);
            for (int seatIndex = 0; seatIndex < row.size(); seatIndex++) {
                ExcelCandidateResponse candidate = row.get(seatIndex);
                result.add(new LabeledSeat(rowLabel, start + seatIndex,
                        candidate.x().add(candidate.width().divide(BigDecimal.TWO)),
                        candidate.y().add(candidate.height().divide(BigDecimal.TWO)), candidate.candidateId()));
            }
        }
        for (SeatCreateRequest manual : area.manualSeatsOrEmpty()) {
            if (manual.seatX() == null || manual.seatY() == null
                    || !inside(area, manual.seatX(), manual.seatY())) {
                throw new BusinessException(StadiumErrorCode.INVALID_EXCEL_MAPPING);
            }
            result.add(new LabeledSeat(manual.rowLabel(), manual.seatNumber(),
                    manual.seatX(), manual.seatY(), null));
        }
        Set<String> labels = new HashSet<>();
        if (result.stream().anyMatch(seat -> !labels.add(seat.rowLabel() + "#" + seat.seatNumber()))) {
            throw new BusinessException(StadiumErrorCode.DUPLICATE_SEAT);
        }
        return result;
    }

    private List<List<ExcelCandidateResponse>> groupRows(List<ExcelCandidateResponse> selected) {
        List<List<ExcelCandidateResponse>> rows = new ArrayList<>();
        for (ExcelCandidateResponse candidate : selected) {
            if (rows.isEmpty()) {
                rows.add(new ArrayList<>(List.of(candidate)));
                continue;
            }
            List<ExcelCandidateResponse> last = rows.getLast();
            BigDecimal reference = last.stream().map(ExcelCandidateResponse::y)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .divide(BigDecimal.valueOf(last.size()), 2, java.math.RoundingMode.HALF_UP);
            BigDecimal tolerance = candidate.height().multiply(new BigDecimal("0.7")).max(new BigDecimal("4"));
            if (candidate.y().subtract(reference).abs().compareTo(tolerance) <= 0) last.add(candidate);
            else rows.add(new ArrayList<>(List.of(candidate)));
        }
        return rows;
    }

    /** 스탠딩의 seat는 위치가 아니라 선점 가능한 입장권 재고 단위다. */
    private List<LabeledSeat> buildStandingInventory(int capacity) {
        List<LabeledSeat> seats = new ArrayList<>(capacity);
        for (int number = 1; number <= capacity; number++) {
            seats.add(new LabeledSeat("STANDING", number, null, null, null));
        }
        return seats;
    }

    private boolean inside(LayoutImportAreaRequest area, ExcelCandidateResponse candidate) {
        return inside(area, candidate.x().add(candidate.width().divide(BigDecimal.TWO)),
                candidate.y().add(candidate.height().divide(BigDecimal.TWO)));
    }

    private boolean inside(LayoutImportAreaRequest area, BigDecimal x, BigDecimal y) {
        return x.compareTo(area.bounds().x()) >= 0
                && x.compareTo(area.bounds().x().add(area.bounds().width())) <= 0
                && y.compareTo(area.bounds().y()) >= 0
                && y.compareTo(area.bounds().y().add(area.bounds().height())) <= 0;
    }

    private void validateBounds(LayoutImportAreaRequest area, int width, int height) {
        if (area.bounds().x().add(area.bounds().width()).compareTo(BigDecimal.valueOf(width)) > 0
                || area.bounds().y().add(area.bounds().height()).compareTo(BigDecimal.valueOf(height)) > 0) {
            throw new BusinessException(StadiumErrorCode.INVALID_LAYOUT);
        }
    }

    private void validateLayoutElements(List<Map<String, Object>> elements, int width, int height) {
        for (Map<String, Object> element : elements) {
            if (element == null || element.get("type") == null) {
                throw new BusinessException(StadiumErrorCode.INVALID_LAYOUT);
            }
            for (String key : List.of("x", "y", "width", "height")) {
                Object value = element.get(key);
                if (value instanceof Number number && number.doubleValue() < 0) {
                    throw new BusinessException(StadiumErrorCode.INVALID_LAYOUT);
                }
            }
            if (number(element.get("x")) + number(element.get("width")) > width
                    || number(element.get("y")) + number(element.get("height")) > height) {
                throw new BusinessException(StadiumErrorCode.INVALID_LAYOUT);
            }
        }
    }

    private double number(Object value) {
        return value instanceof Number number ? number.doubleValue() : 0;
    }

    private static final String HANGUL_ROW_ALPHABET = "가나다라마바사아자차카타파하";

    private static String alpha(int index) {
        StringBuilder value = new StringBuilder();
        int current = index;
        do {
            value.insert(0, (char) ('A' + current % 26));
            current = current / 26 - 1;
        } while (current >= 0);
        return value.toString();
    }

    private static String hangul(int index) {
        StringBuilder value = new StringBuilder();
        int current = index;
        int base = HANGUL_ROW_ALPHABET.length();
        do {
            value.insert(0, HANGUL_ROW_ALPHABET.charAt(current % base));
            current = current / base - 1;
        } while (current >= 0);
        return value.toString();
    }

    static String rowLabel(SeatLabelingRuleRequest rule, boolean hangulRows, int rowIndex) {
        int startRowIndex = startRowIndex(rule, hangulRows);
        return hangulRows
                ? hangul(startRowIndex + rowIndex)
                : alpha(startRowIndex + rowIndex);
    }

    private static int startRowIndex(SeatLabelingRuleRequest rule, boolean hangulRows) {
        String startRowLabel = rule == null ? null : rule.startRowLabel();
        if (startRowLabel == null || startRowLabel.isBlank()) return 0;
        String normalized = startRowLabel.strip();
        try {
            if (hangulRows) {
                int base = HANGUL_ROW_ALPHABET.length();
                int value = 0;
                for (int index = 0; index < normalized.length(); index++) {
                    int position = HANGUL_ROW_ALPHABET.indexOf(normalized.charAt(index));
                    if (position < 0) throw new NumberFormatException();
                    value = Math.addExact(Math.multiplyExact(value, base), position + 1);
                }
                if (value < 1) throw new NumberFormatException();
                return value - 1;
            }
            String upper = normalized.toUpperCase(java.util.Locale.ROOT);
            if (!upper.matches("[A-Z]+")) throw new NumberFormatException();
            int value = 0;
            for (int index = 0; index < upper.length(); index++) {
                value = Math.addExact(Math.multiplyExact(value, 26), upper.charAt(index) - 'A' + 1);
            }
            return value - 1;
        } catch (ArithmeticException | NumberFormatException exception) {
            throw new BusinessException(StadiumErrorCode.INVALID_EXCEL_MAPPING);
        }
    }

    private void clearDefault(Long stadiumId) {
        layoutRepository.findAllByStadiumIdOrderByDefaultLayoutDescCreatedAtAsc(stadiumId)
                .forEach(layout -> layout.markDefault(false));
        layoutRepository.flush();
    }

    private StadiumLayout getLayoutEntity(Long layoutId) {
        return layoutRepository.findByIdWithStadium(layoutId)
                .orElseThrow(() -> new BusinessException(StadiumErrorCode.LAYOUT_NOT_FOUND));
    }

    private Stadium getStadium(Long stadiumId) {
        return stadiumRepository.findById(stadiumId)
                .orElseThrow(() -> new BusinessException(StadiumErrorCode.STADIUM_NOT_FOUND));
    }

    private void ensureStadium(Long stadiumId) {
        if (!stadiumRepository.existsById(stadiumId)) {
            throw new BusinessException(StadiumErrorCode.STADIUM_NOT_FOUND);
        }
    }

    private void ensureCanManage(Stadium stadium, AuthUser authUser) {
        if (authUser.role() == UserRole.ADMIN) return;
        if (authUser.role() == UserRole.STADIUM && stadium.isManagedBy(authUser.id())) return;
        throw new BusinessException(AuthErrorCode.ACCESS_DENIED);
    }

    private record LabeledSeat(
            String rowLabel, int seatNumber, BigDecimal x, BigDecimal y, String candidateId) {
    }

    private record LayoutCapacity(long seated, long standing) {
        private long total() {
            return seated + standing;
        }
    }
}
