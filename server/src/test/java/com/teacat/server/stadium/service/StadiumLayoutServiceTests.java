package com.teacat.server.stadium.service;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.stadium.dto.request.LayoutBoundsRequest;
import com.teacat.server.stadium.dto.request.LayoutImportAreaRequest;
import com.teacat.server.stadium.dto.request.StadiumLayoutCreateRequest;
import com.teacat.server.stadium.entity.Area;
import com.teacat.server.stadium.entity.AreaType;
import com.teacat.server.stadium.entity.Stadium;
import com.teacat.server.stadium.entity.StadiumLayout;
import com.teacat.server.stadium.entity.StadiumLayoutSaveMode;
import com.teacat.server.stadium.entity.StadiumLayoutStatus;
import com.teacat.server.stadium.exception.StadiumErrorCode;
import com.teacat.server.stadium.repository.AreaRepository;
import com.teacat.server.stadium.repository.ExcelLayoutAnalysisRepository;
import com.teacat.server.stadium.repository.SeatBatchRepository;
import com.teacat.server.stadium.repository.SeatRepository;
import com.teacat.server.stadium.repository.StadiumLayoutRepository;
import com.teacat.server.stadium.repository.StadiumRepository;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StadiumLayoutServiceTests {

    private static final AuthUser ADMIN = new AuthUser(1L, UserRole.ADMIN);

    @Test void requestAreaOrderIsStoredInsteadOfAlphabeticalOrder() {
        Stadium stadium = Stadium.create("Venue", "Seoul", null, 100, null);
        when(stadiumRepository.findById(1L)).thenReturn(Optional.of(stadium));
        when(layoutRepository.saveAndFlush(any(StadiumLayout.class))).thenAnswer(i -> i.getArgument(0));
        when(areaRepository.saveAndFlush(any(Area.class))).thenAnswer(i -> i.getArgument(0));
        var base = request(StadiumLayoutSaveMode.DRAFT, 10);
        var areas = List.of("front", "middle", "back").stream().map(code -> new LayoutImportAreaRequest(
                code, "1F", "1F", AreaType.STANDING, 10, base.areas().getFirst().bounds(), List.of(), List.of(), null)).toList();
        stadiumLayoutService.createFromExcel(1L, ADMIN, new StadiumLayoutCreateRequest(null, "Ordered", false,
                StadiumLayoutSaveMode.DRAFT, "1F", 100, 100, areas, List.of()));
        var captor = ArgumentCaptor.forClass(Area.class);
        org.mockito.Mockito.verify(areaRepository, org.mockito.Mockito.times(3)).saveAndFlush(captor.capture());
        assertThat(captor.getAllValues()).extracting(Area::getAreaCode).containsExactly("front", "middle", "back");
        assertThat(captor.getAllValues()).extracting(Area::getDisplayOrder).containsExactly(0, 1, 2);
    }

    @Mock
    private StadiumRepository stadiumRepository;
    @Mock
    private StadiumLayoutRepository layoutRepository;
    @Mock
    private AreaRepository areaRepository;
    @Mock
    private SeatRepository seatRepository;
    @Mock
    private SeatBatchRepository seatBatchRepository;
    @Mock
    private ExcelLayoutAnalysisRepository analysisRepository;
    @Mock
    private ExcelLayoutParser excelLayoutParser;
    @Mock
    private FileStorageService fileStorageService;

    @InjectMocks
    private StadiumLayoutService stadiumLayoutService;

    @Test
    void 최종_등록한_일반_배치는_ACTIVE로_저장한다() {
        Stadium stadium = Stadium.create("테스트 공연장", "서울", null, 100, null);
        StadiumLayout defaultLayout = StadiumLayout.create(
                stadium, "기본 배치", 100, 100, List.of(), true, StadiumLayoutStatus.ACTIVE);
        when(stadiumRepository.findById(1L)).thenReturn(Optional.of(stadium));
        when(layoutRepository.findDefaultByStadiumId(1L)).thenReturn(Optional.of(defaultLayout));
        when(layoutRepository.saveAndFlush(any(StadiumLayout.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(areaRepository.saveAndFlush(any(Area.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        stadiumLayoutService.createFromExcel(1L, ADMIN, request(StadiumLayoutSaveMode.PUBLISH, 50));

        ArgumentCaptor<StadiumLayout> captor = ArgumentCaptor.forClass(StadiumLayout.class);
        verify(layoutRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(StadiumLayoutStatus.ACTIVE);
        assertThat(captor.getValue().isDefaultLayout()).isFalse();
    }

    @Test
    void 임시저장한_배치는_DRAFT로_저장한다() {
        Stadium stadium = Stadium.create("테스트 공연장", "서울", null, 100, null);
        when(stadiumRepository.findById(1L)).thenReturn(Optional.of(stadium));
        when(layoutRepository.saveAndFlush(any(StadiumLayout.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(areaRepository.saveAndFlush(any(Area.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        stadiumLayoutService.createFromExcel(1L, ADMIN, request(StadiumLayoutSaveMode.DRAFT, 50));

        ArgumentCaptor<StadiumLayout> captor = ArgumentCaptor.forClass(StadiumLayout.class);
        verify(layoutRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(StadiumLayoutStatus.DRAFT);
        assertThat(captor.getValue().isDefaultLayout()).isFalse();
    }

    @Test
    void 배치_수용_인원이_공연장_최대치를_초과하면_등록할_수_없다() {
        Stadium stadium = Stadium.create("테스트 공연장", "서울", null, 49, null);
        when(stadiumRepository.findById(1L)).thenReturn(Optional.of(stadium));
        when(layoutRepository.findDefaultByStadiumId(1L)).thenReturn(Optional.empty());
        when(layoutRepository.saveAndFlush(any(StadiumLayout.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        assertThatThrownBy(() -> stadiumLayoutService.createFromExcel(
                1L, ADMIN, request(StadiumLayoutSaveMode.PUBLISH, 50)))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                        .isEqualTo(StadiumErrorCode.LAYOUT_CAPACITY_EXCEEDED));
        verify(areaRepository, never()).saveAndFlush(any(Area.class));
    }

    private StadiumLayoutCreateRequest request(StadiumLayoutSaveMode saveMode, int standingCapacity) {
        LayoutImportAreaRequest area = new LayoutImportAreaRequest(
                "A", "1F", "1F", AreaType.STANDING, standingCapacity,
                new LayoutBoundsRequest(BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.TEN, BigDecimal.TEN),
                List.of(), List.of(), null);
        return new StadiumLayoutCreateRequest(
                null, "새 배치", false, saveMode, "1F", 100, 100,
                List.of(area), List.of());
    }
}
