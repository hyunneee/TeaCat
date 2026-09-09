package com.teacat.server.performance.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.performance.dto.request.PerformanceAreaSaveRequest;
import com.teacat.server.performance.entity.PerformanceArea;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceAreaRepository;
import com.teacat.server.performance.repository.PerformanceGeneralRepository;
import com.teacat.server.stadium.entity.Area;
import com.teacat.server.stadium.entity.Stadium;
import com.teacat.server.stadium.repository.AreaRepository;
import com.teacat.server.ticket.repository.TicketRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

/**
 * 구역 설정 저장 (API-268) 의 판매 이력 보호장치.
 *
 * <p>판매량을 티켓에서 세도록 바꾸기 전에는 {@code performance_areas.sold_cnt} 를 봤는데, 그 값을
 * 갱신하는 코드가 없어 늘 0 이었다. 그래서 <b>두 검사 모두 통과만 하고 있었다.</b>
 * 이 테스트가 그 회귀를 막는다.
 */
@ExtendWith(MockitoExtension.class)
class AdminPerformanceServiceAreaTests {

    private static final Long OWNER = 6L;
    private static final Long CONCERT_ID = 1L;
    private static final Long AREA_ID = 10L;

    @Mock
    private PerformanceGeneralRepository performanceGeneralRepository;

    @Mock
    private PerformanceAreaRepository performanceAreaRepository;

    @Mock
    private AreaRepository areaRepository;

    @Mock
    private TicketRepository ticketRepository;

    @InjectMocks
    private AdminPerformanceService service;

    private Area area;
    private PerformanceArea performanceArea;

    @BeforeEach
    void setUp() {
        // Stadium·Area 는 읽기 전용 엔티티라 팩토리가 없다. 여기서 필요한 건 id 뿐이다
        Stadium stadium = mock(Stadium.class);
        given(stadium.getId()).willReturn(100L);

        area = mock(Area.class);
        given(area.getId()).willReturn(AREA_ID);

        PerformanceGeneral performance = PerformanceGeneral.create(
                stadium, "테스트 공연", LocalDateTime.of(2026, 10, 1, 20, 0),
                LocalDate.of(2026, 9, 1), null, null, OWNER);
        ReflectionTestUtils.setField(performance, "id", CONCERT_ID);

        performanceArea = PerformanceArea.create(performance, area, "VIP", 88_000, 100);

        given(performanceGeneralRepository.findById(CONCERT_ID)).willReturn(Optional.of(performance));
        given(areaRepository.findByStadiumId(100L)).willReturn(List.of(area));
        given(performanceAreaRepository.findAllByPerformanceId(CONCERT_ID))
                .willReturn(List.of(performanceArea));
    }

    @Test
    void 이미_판_수량보다_적게_최대수량을_낮출_수_없다() {
        givenSold(30);

        // 30장 팔았는데 정원을 20으로 낮추면 이미 판 티켓의 근거가 무너진다
        assertThatThrownBy(() -> service.saveAreas(CONCERT_ID, request(AREA_ID, 20), OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PerformanceErrorCode.AREA_MAX_CNT_BELOW_SOLD);
    }

    @Test
    void 판매_이력이_있는_구역을_뺄_수_없다() {
        givenSold(30);

        // PUT 이라 목록에서 빠지면 삭제다. 판 구역을 지우면 그 티켓의 가격·등급 근거가 사라진다
        assertThatThrownBy(() -> service.saveAreas(CONCERT_ID, emptyRequest(), OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PerformanceErrorCode.AREA_MAX_CNT_BELOW_SOLD);
    }

    @Test
    void 판매_이력이_없으면_자유롭게_바꿀_수_있다() {
        givenSold(0);
        given(performanceAreaRepository.saveAll(org.mockito.ArgumentMatchers.anyList()))
                .willReturn(List.of(performanceArea));

        assertThatCode(() -> service.saveAreas(CONCERT_ID, request(AREA_ID, 20), OWNER))
                .doesNotThrowAnyException();
    }

    @Test
    void 판_수량과_같은_값까지는_낮출_수_있다() {
        givenSold(30);
        given(performanceAreaRepository.saveAll(org.mockito.ArgumentMatchers.anyList()))
                .willReturn(List.of(performanceArea));

        assertThatCode(() -> service.saveAreas(CONCERT_ID, request(AREA_ID, 30), OWNER))
                .doesNotThrowAnyException();
    }

    private void givenSold(long soldCount) {
        given(ticketRepository.countSoldByArea(CONCERT_ID))
                .willReturn(soldCount == 0 ? List.of() : List.of(soldCount(AREA_ID, soldCount)));
    }

    private TicketRepository.AreaSoldCount soldCount(Long areaId, long count) {
        return new TicketRepository.AreaSoldCount() {
            @Override
            public Long getAreaId() {
                return areaId;
            }

            @Override
            public long getSoldCount() {
                return count;
            }
        };
    }

    private PerformanceAreaSaveRequest request(Long areaId, Integer maxCnt) {
        return new PerformanceAreaSaveRequest(List.of(
                new PerformanceAreaSaveRequest.AreaSetting(areaId, "VIP", 88_000, maxCnt)));
    }

    private PerformanceAreaSaveRequest emptyRequest() {
        return new PerformanceAreaSaveRequest(List.of());
    }
}
