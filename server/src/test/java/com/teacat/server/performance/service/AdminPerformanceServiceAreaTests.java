package com.teacat.server.performance.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.performance.dto.request.PerformanceAreaSaveRequest;
import com.teacat.server.performance.dto.response.PerformanceAreaResponse;
import com.teacat.server.performance.entity.PerformanceArea;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceAreaRepository;
import com.teacat.server.performance.repository.PerformanceGeneralRepository;
import com.teacat.server.stadium.entity.Area;
import com.teacat.server.stadium.entity.AreaType;
import com.teacat.server.stadium.entity.Stadium;
import com.teacat.server.stadium.entity.StadiumLayout;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

/**
 * 구역 설정 저장 (API-268) 의 판매 이력 보호장치와 판매 방식(좌석제/스탠딩) 규칙.
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
    private static final Long STANDING_AREA_ID = 11L;
    private static final Long LAYOUT_ID = 100L;

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

    /** 좌석이 깔린 구역. 이 공연에는 이미 좌석제로 설정돼 있다 */
    private Area area;

    /** 좌석 좌표가 없는 구역. 이 공연에는 아직 설정돼 있지 않다 */
    private Area standingArea;

    private PerformanceArea performanceArea;

    @BeforeEach
    void setUp() {
        // Stadium, Area, StadiumLayout 은 읽기 전용 엔티티라 팩토리가 없다. 여기서 필요한 건 id 와 형태 뿐이다
        Stadium stadium = mock(Stadium.class);

        StadiumLayout layout = mock(StadiumLayout.class);
        given(layout.getId()).willReturn(LAYOUT_ID);

        area = mock(Area.class);
        given(area.getId()).willReturn(AREA_ID);
        // 형태는 판매 방식을 정할 때만 읽는다. 앞선 검사에서 먼저 걸러지는 테스트도 있어 lenient
        lenient().when(area.getType()).thenReturn(AreaType.SEATED);
        lenient().when(area.isSeated()).thenReturn(true);

        standingArea = mock(Area.class);
        given(standingArea.getId()).willReturn(STANDING_AREA_ID);
        lenient().when(standingArea.getType()).thenReturn(AreaType.STANDING);
        lenient().when(standingArea.isSeated()).thenReturn(false);

        // 구역 목록은 공연장이 아니라 그 공연이 쓰는 배치도 기준이다
        PerformanceGeneral performance = PerformanceGeneral.create(
                stadium, layout, "테스트 공연", LocalDateTime.of(2026, 10, 1, 20, 0),
                LocalDate.of(2026, 9, 1), null, null, OWNER);
        ReflectionTestUtils.setField(performance, "id", CONCERT_ID);

        performanceArea = PerformanceArea.create(performance, area, "VIP", 88_000, 100, AreaType.SEATED);

        given(performanceGeneralRepository.findById(CONCERT_ID)).willReturn(Optional.of(performance));
        given(areaRepository.findAllByStadiumLayoutIdOrderByLevelCodeAscAreaCodeAsc(LAYOUT_ID))
                .willReturn(List.of(area, standingArea));
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

        // PUT 이라 목록에서 빠지면 삭제다. 판 구역을 지우면 그 티켓의 가격, 등급 근거가 사라진다
        assertThatThrownBy(() -> service.saveAreas(CONCERT_ID, emptyRequest(), OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PerformanceErrorCode.AREA_MAX_CNT_BELOW_SOLD);
    }

    @Test
    void 판매_이력이_없으면_자유롭게_바꿀_수_있다() {
        givenSold(0);
        givenSaveReturnsInput();

        assertThatCode(() -> service.saveAreas(CONCERT_ID, request(AREA_ID, 20), OWNER))
                .doesNotThrowAnyException();
    }

    @Test
    void 판_수량과_같은_값까지는_낮출_수_있다() {
        givenSold(30);
        givenSaveReturnsInput();

        assertThatCode(() -> service.saveAreas(CONCERT_ID, request(AREA_ID, 30), OWNER))
                .doesNotThrowAnyException();
    }

    @Test
    void 좌석제_구역을_스탠딩으로_팔_수_있다() {
        givenSold(0);
        givenSaveReturnsInput();

        // 플로어에 의자를 두지 않는 경우다. 좌석을 만들지 않고 max_cnt 로 수량만 관리한다
        assertThatCode(() -> service.saveAreas(CONCERT_ID, request(AREA_ID, 300, AreaType.STANDING), OWNER))
                .doesNotThrowAnyException();
        assertThat(performanceArea.getSaleType()).isEqualTo(AreaType.STANDING);
    }

    @Test
    void 스탠딩_구역은_좌석제로_팔_수_없다() {
        givenSold(0);

        // 스탠딩 구역에는 좌석 좌표가 없어 배정할 자리가 없다
        assertThatThrownBy(() ->
                service.saveAreas(CONCERT_ID, request(STANDING_AREA_ID, 100, AreaType.SEATED), OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PerformanceErrorCode.AREA_SALE_TYPE_NOT_ALLOWED);
    }

    @Test
    void 판매_이력이_있으면_판매_방식을_바꿀_수_없다() {
        givenSold(30);

        // 좌석제로 팔린 티켓은 좌석을 가리키는데 스탠딩으로 바꾸면 그 좌석이 사라진다
        assertThatThrownBy(() ->
                service.saveAreas(CONCERT_ID, request(AREA_ID, 300, AreaType.STANDING), OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PerformanceErrorCode.AREA_SALE_TYPE_LOCKED);
    }

    @Test
    void 판매_방식을_생략하면_이미_저장된_방식을_그대로_둔다() {
        givenSold(0);
        givenSaveReturnsInput();
        performanceArea.updateSetting("VIP", 88_000, 300, AreaType.STANDING);

        service.saveAreas(CONCERT_ID, request(AREA_ID, 300), OWNER);

        // 판매 방식을 모르는 옛 클라이언트가 저장할 때마다 좌석제로 되돌려서는 안 된다
        assertThat(performanceArea.getSaleType()).isEqualTo(AreaType.STANDING);
    }

    @Test
    void 새_구역은_판매_방식을_생략하면_공연장_구역의_형태를_따른다() {
        givenSold(0);
        givenSaveReturnsInput();

        List<PerformanceAreaResponse> saved =
                service.saveAreas(CONCERT_ID, request(STANDING_AREA_ID, 300), OWNER);

        assertThat(saved).singleElement()
                .extracting(PerformanceAreaResponse::saleType)
                .isEqualTo(AreaType.STANDING);
    }

    @Test
    void 스탠딩으로_팔면_인원_상한이_있어야_한다() {
        givenSold(0);

        // 좌석 행이 없어 max_cnt 가 인원을 제한하는 유일한 근거다. 비우면 무제한이 된다
        assertThatThrownBy(() ->
                service.saveAreas(CONCERT_ID, request(STANDING_AREA_ID, null), OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PerformanceErrorCode.AREA_MAX_CNT_REQUIRED);
    }

    @Test
    void 스탠딩_인원_상한은_0명일_수_없다() {
        givenSold(0);

        assertThatThrownBy(() ->
                service.saveAreas(CONCERT_ID, request(STANDING_AREA_ID, 0), OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PerformanceErrorCode.AREA_MAX_CNT_REQUIRED);
    }

    @Test
    void 좌석제로_팔면_인원_상한을_생략할_수_있다() {
        givenSold(0);
        givenSaveReturnsInput();

        // 좌석 행 수가 곧 상한이라 따로 적지 않아도 된다
        assertThatCode(() -> service.saveAreas(CONCERT_ID, request(AREA_ID, null), OWNER))
                .doesNotThrowAnyException();
    }

    @Test
    void 좌석제_구역을_스탠딩으로_팔_때도_인원_상한이_필요하다() {
        givenSold(0);

        // 스탠딩으로 팔기로 하면 좌석을 만들지 않으므로 좌석 수는 상한이 되지 못한다
        assertThatThrownBy(() ->
                service.saveAreas(CONCERT_ID, request(AREA_ID, null, AreaType.STANDING), OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(PerformanceErrorCode.AREA_MAX_CNT_REQUIRED);
    }

    private void givenSold(long soldCount) {
        given(ticketRepository.countSoldByArea(CONCERT_ID))
                .willReturn(soldCount == 0 ? List.of() : List.of(soldCount(AREA_ID, soldCount)));
    }

    /** 저장 결과로 응답을 만들기 때문에 넣은 그대로 돌려줘야 한다 */
    private void givenSaveReturnsInput() {
        given(performanceAreaRepository.saveAll(anyList()))
                .willAnswer(invocation -> invocation.getArgument(0));
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

    /** 판매 방식을 생략한 요청. 저장된 방식이 있으면 그대로 쓰고, 새 구역이면 공연장 형태를 쓴다 */
    private PerformanceAreaSaveRequest request(Long areaId, Integer maxCnt) {
        return request(areaId, maxCnt, null);
    }

    private PerformanceAreaSaveRequest request(Long areaId, Integer maxCnt, AreaType saleType) {
        return new PerformanceAreaSaveRequest(List.of(
                new PerformanceAreaSaveRequest.AreaSetting(areaId, "VIP", 88_000, maxCnt, saleType)));
    }

    private PerformanceAreaSaveRequest emptyRequest() {
        return new PerformanceAreaSaveRequest(List.of());
    }
}
