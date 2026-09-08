package com.teacat.server.stadium.service;

import com.teacat.server.auth.exception.AuthErrorCode;
import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.common.storage.StorageErrorCode;
import com.teacat.server.stadium.dto.request.AreaBatchCreateRequest;
import com.teacat.server.stadium.dto.request.AreaCreateRequest;
import com.teacat.server.stadium.dto.request.AreaUpdateRequest;
import com.teacat.server.stadium.dto.request.SeatBatchCreateRequest;
import com.teacat.server.stadium.dto.request.SeatCreateRequest;
import com.teacat.server.stadium.dto.request.SeatUpdateRequest;
import com.teacat.server.stadium.dto.request.StadiumCreateRequest;
import com.teacat.server.stadium.dto.request.StadiumUpdateRequest;
import com.teacat.server.stadium.dto.response.AreaBulkCreateResponse;
import com.teacat.server.stadium.dto.response.AreaDetailResponse;
import com.teacat.server.stadium.dto.response.AreaListResponse;
import com.teacat.server.stadium.dto.response.AreaSummaryResponse;
import com.teacat.server.stadium.dto.response.CreatedAreaResponse;
import com.teacat.server.stadium.dto.response.SeatBulkCreateResponse;
import com.teacat.server.stadium.dto.response.SeatListResponse;
import com.teacat.server.stadium.dto.response.SeatResponse;
import com.teacat.server.stadium.dto.response.StadiumCreateResponse;
import com.teacat.server.stadium.dto.response.StadiumLayoutImageResponse;
import com.teacat.server.stadium.dto.response.StadiumListResponse;
import com.teacat.server.stadium.dto.response.StadiumResponse;
import com.teacat.server.stadium.dto.response.StadiumSummaryResponse;
import com.teacat.server.stadium.entity.Area;
import com.teacat.server.stadium.entity.AreaType;
import com.teacat.server.stadium.entity.Seat;
import com.teacat.server.stadium.entity.Stadium;
import com.teacat.server.stadium.entity.StadiumLayout;
import com.teacat.server.stadium.entity.StadiumLayoutStatus;
import com.teacat.server.stadium.exception.StadiumErrorCode;
import com.teacat.server.stadium.repository.AreaRepository;
import com.teacat.server.stadium.repository.SeatBatchRepository;
import com.teacat.server.stadium.repository.SeatRepository;
import com.teacat.server.stadium.repository.StadiumRepository;
import com.teacat.server.stadium.repository.StadiumLayoutRepository;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.entity.UserRole;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
@Slf4j
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StadiumService {

    private static final String LAYOUT_IMAGE_DIRECTORY = "stadium/layout";
    private static final Set<String> LAYOUT_IMAGE_CONTENT_TYPES = Set.of("image/jpeg", "image/png");
    private static final Set<String> LAYOUT_IMAGE_FORMATS = Set.of("JPEG", "JPG", "PNG");

    private final StadiumRepository stadiumRepository;
    private final StadiumLayoutRepository stadiumLayoutRepository;
    private final AreaRepository areaRepository;
    private final SeatRepository seatRepository;
    private final SeatBatchRepository seatBatchRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    public StadiumListResponse getStadiums() {
        List<StadiumSummaryResponse> stadiums = stadiumRepository.findAllWithStats().stream()
                .map(this::toStadiumSummaryResponse)
                .toList();
        return new StadiumListResponse(stadiums);
    }

    public StadiumResponse getStadium(Long stadiumId) {
        return stadiumRepository.findWithStatsById(stadiumId)
                .map(stadium -> toStadiumResponse(stadium,
                        fileStorageService.presignedUrl(stadium.getLayoutImageKey())))
                .orElseThrow(() -> new BusinessException(StadiumErrorCode.STADIUM_NOT_FOUND));
    }

    public AreaListResponse getAreas(Long stadiumId) {
        ensureStadiumExists(stadiumId);
        List<AreaSummaryResponse> areas = areaRepository.findAllWithStatsByStadiumId(stadiumId).stream()
                .map(this::toAreaSummaryResponse)
                .toList();
        return new AreaListResponse(stadiumId, areas);
    }

    public AreaDetailResponse getArea(Long areaId) {
        AreaRepository.AreaStats area = areaRepository.findWithStatsById(areaId)
                .orElseThrow(() -> new BusinessException(StadiumErrorCode.AREA_NOT_FOUND));
        Stadium stadium = getStadiumEntity(area.getStadiumId());
        return new AreaDetailResponse(
                area.getAreaId(), area.getStadiumId(), stadium.getName(), area.getAreaCode(),
                AreaType.valueOf(area.getType()), area.getMaxSeat(), area.getSeatCount(),
                area.getAreaX(), area.getAreaY(), area.getWidth(), area.getHeight());
    }

    public SeatListResponse getSeats(Long areaId) {
        Area area = getAreaEntity(areaId);
        List<SeatResponse> seats = seatRepository.findAllByAreaIdOrderByRowLabelAscSeatNumberAsc(areaId).stream()
                .map(this::toSeatResponse)
                .toList();
        return new SeatListResponse(area.getId(), area.getAreaCode(), area.getType(), area.getMaxSeat(),
                seats.size(), seats);
    }

    @Transactional
    public StadiumCreateResponse createStadium(AuthUser authUser, StadiumCreateRequest request) {
        User manager = null;
        boolean managedByRequester = authUser.role() == UserRole.STADIUM;
        if (managedByRequester) {
            manager = userRepository.findById(authUser.id())
                    .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
        } else if (authUser.role() != UserRole.ADMIN) {
            throw new BusinessException(AuthErrorCode.ACCESS_DENIED);
        }

        Stadium stadium = stadiumRepository.save(Stadium.create(
                request.name(), request.address(), request.phone(), manager));
        return new StadiumCreateResponse(stadium.getId(), managedByRequester);
    }

    @Transactional
    public void updateStadium(Long stadiumId, AuthUser authUser, StadiumUpdateRequest request) {
        if (request.isEmpty()) {
            throw new BusinessException(StadiumErrorCode.NOTHING_TO_UPDATE);
        }
        Stadium stadium = getStadiumEntity(stadiumId);
        ensureCanManage(stadium, authUser);
        stadium.update(request.name(), request.address(), request.phone());
    }

    @Transactional
    public void deleteStadium(Long stadiumId, AuthUser authUser) {
        Stadium stadium = getStadiumEntity(stadiumId);
        ensureCanManage(stadium, authUser);
        if (stadiumRepository.isInUse(stadiumId)) {
            throw new BusinessException(StadiumErrorCode.STADIUM_IN_USE);
        }
        seatRepository.deleteAllByStadiumId(stadiumId);
        areaRepository.deleteAllByStadiumId(stadiumId);
        stadiumLayoutRepository.deleteAll(stadiumLayoutRepository
                .findAllByStadiumIdOrderByDefaultLayoutDescCreatedAtAsc(stadiumId));
        stadiumRepository.delete(stadium);
        deleteImageAfterCommit(stadium.getLayoutImageKey());
    }

    @Transactional
    public StadiumLayoutImageResponse updateLayoutImage(
            Long stadiumId, AuthUser authUser, MultipartFile image) {
        Stadium stadium = getStadiumEntity(stadiumId);
        ensureCanManage(stadium, authUser);
        LayoutDimensions dimensions = readLayoutDimensions(image);

        if (stadium.hasLayoutDimensions()
                && (stadium.getLayoutWidth() != dimensions.width()
                || stadium.getLayoutHeight() != dimensions.height())
                && stadiumRepository.hasLayoutPositions(stadiumId)) {
            throw new BusinessException(StadiumErrorCode.LAYOUT_IMAGE_SIZE_CONFLICT);
        }
        if (stadiumRepository.hasLayoutPositionsOutside(
                stadiumId, dimensions.width(), dimensions.height())) {
            throw new BusinessException(StadiumErrorCode.INVALID_LAYOUT_POSITION);
        }

        String oldKey = stadium.getLayoutImageKey();
        String newKey = fileStorageService.uploadImage(image, LAYOUT_IMAGE_DIRECTORY);
        replaceImageAfterTransaction(newKey, oldKey);

        stadium.updateLayoutImage(newKey, dimensions.width(), dimensions.height());
        StadiumLayout defaultLayout = stadiumLayoutRepository.findDefaultByStadiumId(stadiumId)
                .orElseGet(() -> stadiumLayoutRepository.save(StadiumLayout.create(
                        stadium, "기본 배치", dimensions.width(), dimensions.height(), List.of(),
                        true, StadiumLayoutStatus.ACTIVE)));
        defaultLayout.updateImage(newKey, dimensions.width(), dimensions.height());
        stadiumRepository.flush();
        String layoutImageUrl = fileStorageService.presignedUrl(newKey);
        return new StadiumLayoutImageResponse(
                stadiumId, layoutImageUrl, dimensions.width(), dimensions.height());
    }

    @Transactional
    public void deleteLayoutImage(Long stadiumId, AuthUser authUser) {
        Stadium stadium = getStadiumEntity(stadiumId);
        ensureCanManage(stadium, authUser);
        String oldKey = stadium.getLayoutImageKey();
        if (oldKey == null) {
            return;
        }

        boolean keepDimensions = stadiumRepository.hasLayoutPositions(stadiumId);
        stadium.removeLayoutImage(keepDimensions);
        stadiumLayoutRepository.findDefaultByStadiumId(stadiumId).ifPresent(StadiumLayout::removeImage);
        deleteImageAfterCommit(oldKey);
    }

    @Transactional
    public AreaBulkCreateResponse createAreas(
            Long stadiumId, AuthUser authUser, AreaBatchCreateRequest request) {
        Stadium stadium = getStadiumEntity(stadiumId);
        ensureCanManage(stadium, authUser);
        StadiumLayout layout = stadiumLayoutRepository.findDefaultByStadiumId(stadiumId)
                .orElseThrow(() -> new BusinessException(StadiumErrorCode.LAYOUT_NOT_FOUND));
        validateAreaBatch(stadium, layout, request.areas());

        List<CreatedAreaResponse> createdAreas = new ArrayList<>();
        List<SeatBatchRepository.SeatBatchRow> seatsToInsert = new ArrayList<>();
        int createdSeatCount = 0;

        try {
            for (AreaCreateRequest areaRequest : request.areas()) {
                Area area = areaRepository.saveAndFlush(Area.create(
                        stadium, layout, areaRequest.areaCode(), areaRequest.type(), areaRequest.maxSeat(),
                        areaRequest.areaX(), areaRequest.areaY(), areaRequest.height(), areaRequest.width()));
                List<SeatCreateRequest> seats = areaRequest.seatsOrEmpty();
                seatsToInsert.addAll(toBatchRows(area.getId(), seats));
                createdAreas.add(new CreatedAreaResponse(area.getId(), area.getAreaCode(), seats.size()));
                createdSeatCount += seats.size();
            }
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(StadiumErrorCode.DUPLICATE_AREA_CODE);
        }

        insertSeats(seatsToInsert);
        return new AreaBulkCreateResponse(createdAreas.size(), createdSeatCount, createdAreas);
    }

    @Transactional
    public void updateArea(Long areaId, AuthUser authUser, AreaUpdateRequest request) {
        if (request.isEmpty()) {
            throw new BusinessException(StadiumErrorCode.NOTHING_TO_UPDATE);
        }
        Area area = getAreaEntity(areaId);
        ensureCanManage(area.getStadium(), authUser);

        long currentSeatCount = seatRepository.countByAreaId(areaId);
        if (changesStructure(area, request) && areaRepository.isInUse(areaId)) {
            throw new BusinessException(StadiumErrorCode.AREA_STRUCTURE_LOCKED);
        }
        if (request.areaCode() != null && !request.areaCode().equals(area.getAreaCode())
                && areaRepository.existsByStadiumLayoutIdAndAreaCodeAndIdNot(
                area.getStadiumLayout().getId(), request.areaCode(), areaId)) {
            throw new BusinessException(StadiumErrorCode.DUPLICATE_AREA_CODE);
        }
        if (request.maxSeat() != null && request.maxSeat() < currentSeatCount) {
            throw new BusinessException(StadiumErrorCode.MAX_SEAT_BELOW_CURRENT);
        }
        if (request.type() == AreaType.STANDING && area.getType() != AreaType.STANDING && currentSeatCount > 0) {
            throw new BusinessException(StadiumErrorCode.AREA_STRUCTURE_LOCKED);
        }

        LayoutRect updatedLayout = mergeAreaLayout(area, request);
        validateAreaLayout(area.getStadium(), updatedLayout);
        for (Seat seat : seatRepository.findAllByAreaIdOrderByRowLabelAscSeatNumberAsc(areaId)) {
            validateSeatLayout(area.getStadium(), updatedLayout,
                    new LayoutPoint(seat.getSeatX(), seat.getSeatY()));
        }

        area.update(request.areaCode(), request.type(), request.maxSeat(), request.areaX(), request.areaY(),
                request.height(), request.width());
    }

    @Transactional
    public void deleteArea(Long areaId, AuthUser authUser) {
        Area area = getAreaEntity(areaId);
        ensureCanManage(area.getStadium(), authUser);
        if (areaRepository.isInUse(areaId)) {
            throw new BusinessException(StadiumErrorCode.AREA_IN_USE);
        }
        seatRepository.deleteAllByAreaId(areaId);
        areaRepository.delete(area);
    }

    @Transactional
    public SeatBulkCreateResponse createSeats(
            Long areaId, AuthUser authUser, SeatBatchCreateRequest request) {
        Area area = getAreaEntity(areaId);
        ensureCanManage(area.getStadium(), authUser);
        if (area.getType() == AreaType.STANDING) {
            throw new BusinessException(StadiumErrorCode.STANDING_AREA_HAS_SEATS);
        }

        List<Seat> existingSeats = seatRepository.findAllByAreaIdOrderByRowLabelAscSeatNumberAsc(areaId);
        if ((long) existingSeats.size() + request.seats().size() > area.getMaxSeat()) {
            throw new BusinessException(StadiumErrorCode.MAX_SEAT_EXCEEDED);
        }
        Set<SeatKey> keys = new HashSet<>();
        existingSeats.forEach(seat -> keys.add(new SeatKey(seat.getRowLabel(), seat.getSeatNumber())));
        validateUniqueSeatKeys(request.seats(), keys);
        LayoutRect areaLayout = toAreaLayout(area);
        request.seats().forEach(seat -> validateSeatLayout(
                area.getStadium(), areaLayout, new LayoutPoint(seat.seatX(), seat.seatY())));

        insertSeats(toBatchRows(areaId, request.seats()));
        return new SeatBulkCreateResponse(areaId, request.seats().size(),
                (long) existingSeats.size() + request.seats().size());
    }

    @Transactional
    public void updateSeat(Long seatId, AuthUser authUser, SeatUpdateRequest request) {
        if (request.isEmpty()) {
            throw new BusinessException(StadiumErrorCode.NOTHING_TO_UPDATE);
        }
        Seat seat = seatRepository.findByIdWithAreaAndStadium(seatId)
                .orElseThrow(() -> new BusinessException(StadiumErrorCode.SEAT_NOT_FOUND));
        ensureCanManage(seat.getArea().getStadium(), authUser);
        if (seatRepository.isInUse(seatId)) {
            throw new BusinessException(StadiumErrorCode.SEAT_UPDATE_LOCKED);
        }

        String rowLabel = request.rowLabel() == null ? seat.getRowLabel() : request.rowLabel();
        int seatNumber = request.seatNumber() == null ? seat.getSeatNumber() : request.seatNumber();
        if (seatRepository.existsByAreaIdAndRowLabelAndSeatNumberAndIdNot(
                seat.getArea().getId(), rowLabel, seatNumber, seatId)) {
            throw new BusinessException(StadiumErrorCode.DUPLICATE_SEAT);
        }
        LayoutPoint updatedPosition = new LayoutPoint(
                request.seatX() == null ? seat.getSeatX() : request.seatX(),
                request.seatY() == null ? seat.getSeatY() : request.seatY());
        validateSeatLayout(seat.getArea().getStadium(), toAreaLayout(seat.getArea()), updatedPosition);
        seat.update(request.rowLabel(), request.seatNumber(), request.seatX(), request.seatY());
    }

    @Transactional
    public void deleteSeat(Long seatId, AuthUser authUser) {
        Seat seat = seatRepository.findByIdWithAreaAndStadium(seatId)
                .orElseThrow(() -> new BusinessException(StadiumErrorCode.SEAT_NOT_FOUND));
        ensureCanManage(seat.getArea().getStadium(), authUser);
        if (seatRepository.isInUse(seatId)) {
            throw new BusinessException(StadiumErrorCode.SEAT_IN_USE);
        }
        seatRepository.delete(seat);
    }

    private void validateAreaBatch(Stadium stadium, StadiumLayout layout, List<AreaCreateRequest> areas) {
        Set<String> areaCodes = new HashSet<>();
        for (AreaCreateRequest area : areas) {
            if (!areaCodes.add(area.areaCode())
                    || areaRepository.existsByStadiumLayoutIdAndAreaCode(layout.getId(), area.areaCode())) {
                throw new BusinessException(StadiumErrorCode.DUPLICATE_AREA_CODE);
            }
            LayoutRect areaLayout = new LayoutRect(
                    area.areaX(), area.areaY(), area.width(), area.height());
            validateAreaLayout(stadium, areaLayout);
            List<SeatCreateRequest> seats = area.seatsOrEmpty();
            if (area.type() == AreaType.STANDING && !seats.isEmpty()) {
                throw new BusinessException(StadiumErrorCode.STANDING_AREA_HAS_SEATS);
            }
            if (seats.size() > area.maxSeat()) {
                throw new BusinessException(StadiumErrorCode.MAX_SEAT_EXCEEDED);
            }
            validateUniqueSeatKeys(seats, new HashSet<>());
            seats.forEach(seat -> validateSeatLayout(
                    stadium, areaLayout, new LayoutPoint(seat.seatX(), seat.seatY())));
        }
    }

    private void validateUniqueSeatKeys(List<SeatCreateRequest> seats, Set<SeatKey> keys) {
        for (SeatCreateRequest seat : seats) {
            if (!keys.add(new SeatKey(seat.rowLabel(), seat.seatNumber()))) {
                throw new BusinessException(StadiumErrorCode.DUPLICATE_SEAT);
            }
        }
    }

    private List<SeatBatchRepository.SeatBatchRow> toBatchRows(
            Long areaId, List<SeatCreateRequest> seats) {
        return seats.stream()
                .map(seat -> new SeatBatchRepository.SeatBatchRow(
                        areaId, seat.seatX(), seat.seatY(), seat.rowLabel(), seat.seatNumber()))
                .toList();
    }

    private void insertSeats(List<SeatBatchRepository.SeatBatchRow> seats) {
        if (seats.isEmpty()) {
            return;
        }
        try {
            seatBatchRepository.insertAll(seats);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(StadiumErrorCode.DUPLICATE_SEAT);
        }
    }

    private LayoutDimensions readLayoutDimensions(MultipartFile image) {
        if (image == null || image.isEmpty()) {
            throw new BusinessException(StorageErrorCode.EMPTY_FILE);
        }
        if (!LAYOUT_IMAGE_CONTENT_TYPES.contains(image.getContentType())) {
            throw new BusinessException(StadiumErrorCode.INVALID_LAYOUT_IMAGE);
        }

        try (var input = image.getInputStream();
             ImageInputStream imageInput = ImageIO.createImageInputStream(input)) {
            if (imageInput == null) {
                throw new IllegalArgumentException("이미지 입력 스트림을 만들 수 없습니다.");
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(imageInput);
            if (!readers.hasNext()) {
                throw new IllegalArgumentException("이미지 형식을 판독할 수 없습니다.");
            }

            ImageReader reader = readers.next();
            try {
                reader.setInput(imageInput, true, true);
                String format = reader.getFormatName().toUpperCase();
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (!LAYOUT_IMAGE_FORMATS.contains(format) || width <= 0 || height <= 0) {
                    throw new IllegalArgumentException("지원하지 않는 좌석표 이미지입니다.");
                }
                return new LayoutDimensions(width, height);
            } finally {
                reader.dispose();
            }
        } catch (IOException | IllegalArgumentException exception) {
            throw new BusinessException(StadiumErrorCode.INVALID_LAYOUT_IMAGE);
        }
    }

    private LayoutRect mergeAreaLayout(Area area, AreaUpdateRequest request) {
        return new LayoutRect(
                request.areaX() == null ? area.getAreaX() : request.areaX(),
                request.areaY() == null ? area.getAreaY() : request.areaY(),
                request.width() == null ? area.getWidth() : request.width(),
                request.height() == null ? area.getHeight() : request.height());
    }

    private LayoutRect toAreaLayout(Area area) {
        return new LayoutRect(area.getAreaX(), area.getAreaY(), area.getWidth(), area.getHeight());
    }

    private void validateAreaLayout(Stadium stadium, LayoutRect layout) {
        if (layout.isEmpty()) {
            return;
        }
        if (!layout.isComplete()
                || layout.x().signum() < 0 || layout.y().signum() < 0
                || layout.width().signum() <= 0 || layout.height().signum() <= 0) {
            throw new BusinessException(StadiumErrorCode.INVALID_LAYOUT_POSITION);
        }
        if (stadium.hasLayoutDimensions()
                && (layout.right().compareTo(BigDecimal.valueOf(stadium.getLayoutWidth())) > 0
                || layout.bottom().compareTo(BigDecimal.valueOf(stadium.getLayoutHeight())) > 0)) {
            throw new BusinessException(StadiumErrorCode.INVALID_LAYOUT_POSITION);
        }
    }

    private void validateSeatLayout(Stadium stadium, LayoutRect areaLayout, LayoutPoint seatPosition) {
        if (seatPosition.isEmpty()) {
            return;
        }
        if (!seatPosition.isComplete() || !areaLayout.isComplete()
                || seatPosition.x().signum() < 0 || seatPosition.y().signum() < 0
                || seatPosition.x().compareTo(areaLayout.x()) < 0
                || seatPosition.x().compareTo(areaLayout.right()) > 0
                || seatPosition.y().compareTo(areaLayout.y()) < 0
                || seatPosition.y().compareTo(areaLayout.bottom()) > 0) {
            throw new BusinessException(StadiumErrorCode.INVALID_LAYOUT_POSITION);
        }
        if (stadium.hasLayoutDimensions()
                && (seatPosition.x().compareTo(BigDecimal.valueOf(stadium.getLayoutWidth())) >= 0
                || seatPosition.y().compareTo(BigDecimal.valueOf(stadium.getLayoutHeight())) >= 0)) {
            throw new BusinessException(StadiumErrorCode.INVALID_LAYOUT_POSITION);
        }
    }

    private void replaceImageAfterTransaction(String newKey, String oldKey) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            deleteQuietly(oldKey);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_COMMITTED) {
                    deleteQuietly(oldKey);
                } else {
                    deleteQuietly(newKey);
                }
            }
        });
    }

    private void deleteImageAfterCommit(String key) {
        if (key == null || key.isBlank()) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            deleteQuietly(key);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_COMMITTED) {
                    deleteQuietly(key);
                }
            }
        });
    }

    private void deleteQuietly(String key) {
        try {
            fileStorageService.delete(key);
        } catch (RuntimeException exception) {
            log.warn("공연장 좌석표 이미지 삭제 실패. 수동 정리 필요. key={}", key, exception);
        }
    }

    private boolean changesStructure(Area area, AreaUpdateRequest request) {
        return request.areaCode() != null && !request.areaCode().equals(area.getAreaCode())
                || request.type() != null && request.type() != area.getType()
                || request.maxSeat() != null && request.maxSeat() != area.getMaxSeat();
    }

    private void ensureCanManage(Stadium stadium, AuthUser authUser) {
        if (authUser.role() == UserRole.ADMIN) {
            return;
        }
        if (authUser.role() == UserRole.STADIUM && stadium.isManagedBy(authUser.id())) {
            return;
        }
        throw new BusinessException(AuthErrorCode.ACCESS_DENIED);
    }

    private void ensureStadiumExists(Long stadiumId) {
        if (!stadiumRepository.existsById(stadiumId)) {
            throw new BusinessException(StadiumErrorCode.STADIUM_NOT_FOUND);
        }
    }

    private Stadium getStadiumEntity(Long stadiumId) {
        return stadiumRepository.findById(stadiumId)
                .orElseThrow(() -> new BusinessException(StadiumErrorCode.STADIUM_NOT_FOUND));
    }

    private Area getAreaEntity(Long areaId) {
        return areaRepository.findByIdWithStadium(areaId)
                .orElseThrow(() -> new BusinessException(StadiumErrorCode.AREA_NOT_FOUND));
    }

    private StadiumSummaryResponse toStadiumSummaryResponse(StadiumRepository.StadiumStats stadium) {
        return new StadiumSummaryResponse(stadium.getStadiumId(), stadium.getName(), stadium.getAddress(),
                stadium.getPhone(), stadium.getAreaCount(), stadium.getTotalCapacity());
    }

    private StadiumResponse toStadiumResponse(StadiumRepository.StadiumStats stadium, String layoutImageUrl) {
        return new StadiumResponse(stadium.getStadiumId(), stadium.getName(), stadium.getAddress(),
                stadium.getPhone(), layoutImageUrl, stadium.getLayoutWidth(), stadium.getLayoutHeight(),
                stadium.getAreaCount(), stadium.getTotalCapacity());
    }

    private AreaSummaryResponse toAreaSummaryResponse(AreaRepository.AreaStats area) {
        return new AreaSummaryResponse(area.getAreaId(), area.getAreaCode(), AreaType.valueOf(area.getType()),
                area.getMaxSeat(), area.getSeatCount(), area.getAreaX(), area.getAreaY(),
                area.getWidth(), area.getHeight());
    }

    private SeatResponse toSeatResponse(Seat seat) {
        return new SeatResponse(seat.getId(), seat.getRowLabel(), seat.getSeatNumber(),
                seat.getSeatX(), seat.getSeatY());
    }

    private record SeatKey(String rowLabel, Integer seatNumber) {
        private SeatKey {
            Objects.requireNonNull(rowLabel);
            Objects.requireNonNull(seatNumber);
        }
    }

    private record LayoutDimensions(int width, int height) {
    }

    private record LayoutRect(BigDecimal x, BigDecimal y, BigDecimal width, BigDecimal height) {
        private boolean isEmpty() {
            return x == null && y == null && width == null && height == null;
        }

        private boolean isComplete() {
            return x != null && y != null && width != null && height != null;
        }

        private BigDecimal right() {
            return x.add(width);
        }

        private BigDecimal bottom() {
            return y.add(height);
        }
    }

    private record LayoutPoint(BigDecimal x, BigDecimal y) {
        private boolean isEmpty() {
            return x == null && y == null;
        }

        private boolean isComplete() {
            return x != null && y != null;
        }
    }
}
