package com.teacat.server.performance.service;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.booking.entity.SeatBookingStatus;
import com.teacat.server.booking.repository.PerformanceSeatRepository;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.performance.dto.request.OperationsCheckInFilter;
import com.teacat.server.performance.dto.response.OperationsAttendeePageResponse;
import com.teacat.server.performance.dto.response.OperationsSeatMapResponse;
import com.teacat.server.performance.entity.PerformanceArea;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceAreaRepository;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.stadium.entity.Area;
import com.teacat.server.stadium.entity.AreaType;
import com.teacat.server.stadium.entity.Seat;
import com.teacat.server.stadium.entity.Stadium;
import com.teacat.server.stadium.entity.StadiumLayout;
import com.teacat.server.stadium.repository.SeatRepository;
import com.teacat.server.ticket.entity.Ticket;
import com.teacat.server.ticket.entity.TicketStatus;
import com.teacat.server.ticket.exception.TicketErrorCode;
import com.teacat.server.ticket.repository.TicketRepository;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Limit;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * 운영 좌석·예매자 조회의 <b>권한·개인정보·상태 판정</b>.
 *
 * <p>여기서 지키는 것 셋.
 * <ul>
 *   <li>담당 공연이 아니면 아무것도 읽지 않는다 — 회차를 읽는 것조차 하지 않는다</li>
 *   <li>경로의 공연은 내 것으로 채우고 회차·티켓만 남의 것으로 바꿔 넣는 우회를 막는다</li>
 *   <li>이름·연락처는 가려서 나간다. 좌석 상태는 입장 여부까지 반영한다</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class PerformanceOperationsServiceTests {

    private static final Long OWNER_ID = 6L;
    private static final AuthUser OWNER = new AuthUser(OWNER_ID, UserRole.PERFORMANCE);
    private static final Long PERFORMANCE_ID = 1L;
    private static final Long OTHER_PERFORMANCE_ID = 2L;
    private static final Long SCHEDULE_ID = 10L;
    private static final Long AREA_ID = 7L;
    private static final Long STANDING_AREA_ID = 8L;
    private static final Long SOLD_SEAT_ID = 100L;
    private static final Long ENTERED_SEAT_ID = 101L;
    private static final Long FREE_SEAT_ID = 102L;
    private static final Long HELD_SEAT_ID = 103L;
    private static final Long TICKET_ID = 1024L;

    @Mock
    private PerformanceOperatorAccess access;

    @Mock
    private PerformanceDetailRepository schedules;

    @Mock
    private PerformanceAreaRepository performanceAreas;

    @Mock
    private PerformanceSeatRepository performanceSeats;

    @Mock
    private SeatRepository seats;

    @Mock
    private TicketRepository tickets;

    @InjectMocks
    private PerformanceOperationsService service;

    private PerformanceDetail schedule;
    /** 구역 설정을 만들 때 필요합니다 (PerformanceArea 는 공연에 매달려 있습니다) */
    private PerformanceGeneral performance;

    @BeforeEach
    void setUp() {
        Stadium stadium = mock(Stadium.class);
        StadiumLayout layout = mock(StadiumLayout.class);

        performance = PerformanceGeneral.create(
                stadium, layout, "테스트 공연", LocalDateTime.of(2026, 10, 1, 20, 0),
                LocalDate.of(2026, 9, 1), null, null, OWNER_ID);
        ReflectionTestUtils.setField(performance, "id", PERFORMANCE_ID);

        schedule = PerformanceDetail.create(performance, 1, LocalDateTime.of(2026, 10, 1, 20, 0));
        ReflectionTestUtils.setField(schedule, "id", SCHEDULE_ID);

        lenient().when(schedules.findById(SCHEDULE_ID)).thenReturn(Optional.of(schedule));
    }

    @Test
    void 담당_공연이_아니면_회차도_읽지_않는다() {
        willThrow(new BusinessException(PerformanceErrorCode.NOT_OWNER))
                .given(access).performance(OWNER, OTHER_PERFORMANCE_ID);

        assertThatThrownBy(() -> service.getSeatMap(OWNER, OTHER_PERFORMANCE_ID, SCHEDULE_ID))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getErrorCode())
                .isEqualTo(PerformanceErrorCode.NOT_OWNER);

        /* 🔴 권한을 먼저 본다. 회차를 먼저 읽으면 권한 없는 사람이 보낸 회차 ID 의
              존재 여부가 응답 차이로 새어 나간다. */
        verify(schedules, never()).findById(any());
        verify(tickets, never()).findConfirmedSeatAssignments(any());
    }

    @Test
    void 내_공연에_남의_회차를_넣으면_거절한다() {
        // 경로의 앞부분(공연)은 내 것이라 권한 검사는 통과한다. 뒷부분만 남의 것이다
        PerformanceGeneral other = PerformanceGeneral.create(
                mock(Stadium.class), mock(StadiumLayout.class), "남의 공연",
                LocalDateTime.of(2026, 11, 1, 20, 0), LocalDate.of(2026, 10, 1), null, null, 99L);
        ReflectionTestUtils.setField(other, "id", OTHER_PERFORMANCE_ID);

        PerformanceDetail otherSchedule = PerformanceDetail.create(other, 1, LocalDateTime.now());
        ReflectionTestUtils.setField(otherSchedule, "id", 99L);
        given(schedules.findById(99L)).willReturn(Optional.of(otherSchedule));

        assertThatThrownBy(() -> service.getSeatMap(OWNER, PERFORMANCE_ID, 99L))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getErrorCode())
                .isEqualTo(PerformanceErrorCode.SCHEDULE_NOT_FOUND);
    }

    @Test
    void 좌석_상태는_예매와_입장을_함께_읽는다() {
        /* 🔴 목을 만드는 일과 스텁을 거는 일을 섞지 마세요 — `given(...)` 의 인자 안에서
              다른 목을 스텁하면 Mockito 가 미완성 스텁으로 봅니다. 재료를 먼저 만듭니다. */
        Area area = seatedArea();
        PerformanceArea configured =
                PerformanceArea.create(performance, area, "VIP", 88_000, 100, AreaType.SEATED);
        List<Seat> areaSeats = List.of(
                seat(SOLD_SEAT_ID, area, "1", 1),
                seat(ENTERED_SEAT_ID, area, "1", 2),
                seat(FREE_SEAT_ID, area, "1", 3),
                seat(HELD_SEAT_ID, area, "1", 4));

        given(performanceAreas.findAllByPerformanceId(PERFORMANCE_ID)).willReturn(List.of(configured));
        given(seats.findByAreaIdIn(anyList())).willReturn(areaSeats);
        given(performanceSeats.findEffectiveStatuses(SCHEDULE_ID)).willReturn(List.of(
                status(SOLD_SEAT_ID, SeatBookingStatus.SOLD),
                status(ENTERED_SEAT_ID, SeatBookingStatus.SOLD),
                status(FREE_SEAT_ID, SeatBookingStatus.AVAILABLE),
                status(HELD_SEAT_ID, SeatBookingStatus.HELD)));
        given(tickets.findConfirmedSeatAssignments(SCHEDULE_ID)).willReturn(List.of(
                assignment(TICKET_ID, AREA_ID, SOLD_SEAT_ID, null),
                assignment(TICKET_ID + 1, AREA_ID, ENTERED_SEAT_ID, LocalDateTime.now())));

        OperationsSeatMapResponse response = service.getSeatMap(OWNER, PERFORMANCE_ID, SCHEDULE_ID);

        Map<Long, OperationsSeatMapResponse.Seat> bySeat = response.areas().getFirst().seats().stream()
                .collect(java.util.stream.Collectors.toMap(OperationsSeatMapResponse.Seat::seatId, s -> s));
        assertThat(bySeat.get(SOLD_SEAT_ID).state())
                .isEqualTo(OperationsSeatMapResponse.SeatState.BOOKED);
        // 🔴 좌석 행은 둘 다 SOLD 다. 입장 여부는 티켓에만 있어서, 티켓을 보지 않으면 구분되지 않는다
        assertThat(bySeat.get(ENTERED_SEAT_ID).state())
                .isEqualTo(OperationsSeatMapResponse.SeatState.CHECKED_IN);
        assertThat(bySeat.get(ENTERED_SEAT_ID).ticketId()).isEqualTo(TICKET_ID + 1);
        assertThat(bySeat.get(FREE_SEAT_ID).state())
                .isEqualTo(OperationsSeatMapResponse.SeatState.AVAILABLE);
        assertThat(bySeat.get(FREE_SEAT_ID).ticketId()).isNull();
        assertThat(bySeat.get(HELD_SEAT_ID).state())
                .isEqualTo(OperationsSeatMapResponse.SeatState.HELD);

        assertThat(response.summary().bookedCount()).isEqualTo(2);
        assertThat(response.summary().checkedInCount()).isEqualTo(1);
        assertThat(response.summary().notCheckedInCount()).isEqualTo(1);
        assertThat(response.summary().heldCount()).isEqualTo(1);
    }

    @Test
    void 스탠딩_구역은_좌석을_그리지_않고_정원과_수만_준다() {
        Area standing = standingArea();
        PerformanceArea configured =
                PerformanceArea.create(performance, standing, "스탠딩", 66_000, 300, AreaType.STANDING);
        // 스탠딩에도 좌표 없는 가상 좌석 행이 있다. 그려 버리면 없는 자리 번호가 화면에 나온다
        List<Seat> virtualSeats = List.of(seat(200L, standing, null, 1), seat(201L, standing, null, 2));

        given(performanceAreas.findAllByPerformanceId(PERFORMANCE_ID)).willReturn(List.of(configured));
        given(seats.findByAreaIdIn(anyList())).willReturn(virtualSeats);
        given(performanceSeats.findEffectiveStatuses(SCHEDULE_ID)).willReturn(List.of());
        given(tickets.findConfirmedSeatAssignments(SCHEDULE_ID)).willReturn(List.of(
                assignment(TICKET_ID, STANDING_AREA_ID, null, LocalDateTime.now())));

        OperationsSeatMapResponse.Area area = service
                .getSeatMap(OWNER, PERFORMANCE_ID, SCHEDULE_ID).areas().getFirst();

        assertThat(area.seats()).isEmpty();
        assertThat(area.capacity()).isEqualTo(300);
        // 좌석이 없는 티켓도 구역 집계에는 들어간다 — 빠지면 입장한 사람이 사라진다
        assertThat(area.bookedCount()).isEqualTo(1);
        assertThat(area.checkedInCount()).isEqualTo(1);
    }

    @Test
    void 명단의_이름과_연락처는_가려서_나간다() {
        List<Ticket> rows = List.of(confirmedTicket("홍길동", "010-1234-5678"));
        given(tickets.findAttendees(eq(SCHEDULE_ID), isNull(), isNull(), isNull(), isNull(),
                isNull(), any(Limit.class))).willReturn(rows);
        given(tickets.countAttendees(SCHEDULE_ID, null, null, null, null)).willReturn(1L);

        OperationsAttendeePageResponse page = service.getAttendees(
                OWNER, PERFORMANCE_ID, SCHEDULE_ID, "  ", null, OperationsCheckInFilter.ALL, null, null);

        assertThat(page.items()).singleElement().satisfies(row -> {
            assertThat(row.holderName()).isEqualTo("홍*동");
            assertThat(row.holderPhone()).isEqualTo("010-****-5678");
            // 닉네임은 서비스에서 이미 공개되는 표시 이름이라 가리지 않는다
            assertThat(row.holderNickname()).isEqualTo("고양이집사");
        });
        assertThat(page.hasNext()).isFalse();
        assertThat(page.nextCursor()).isNull();
        assertThat(page.totalCount()).isEqualTo(1);
    }

    @Test
    void 한_페이지를_넘으면_커서를_준다() {
        // size 를 넘겨 받은 뒤(size+1) 마지막 한 줄은 잘라내고 커서만 남긴다
        List<Ticket> rows = List.of(
                confirmedTicket("김철수", "01011112222"),
                confirmedTicket("이영희", "01033334444"));
        given(tickets.findAttendees(eq(SCHEDULE_ID), isNull(), eq(Boolean.TRUE), isNull(), isNull(),
                eq(50L), any(Limit.class))).willReturn(rows);
        given(tickets.countAttendees(SCHEDULE_ID, null, Boolean.TRUE, null, null)).willReturn(9L);

        OperationsAttendeePageResponse page = service.getAttendees(
                OWNER, PERFORMANCE_ID, SCHEDULE_ID, null, null,
                OperationsCheckInFilter.CHECKED_IN, "50", 1);

        assertThat(page.items()).hasSize(1);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isEqualTo(String.valueOf(TICKET_ID));
    }

    @Test
    void 숫자_검색어는_티켓_번호로도_찾는다() {
        given(tickets.findAttendees(eq(SCHEDULE_ID), isNull(), isNull(), eq("%1024%"), eq(1024L),
                isNull(), any(Limit.class)))
                .willReturn(List.of());
        given(tickets.countAttendees(SCHEDULE_ID, null, null, "%1024%", 1024L)).willReturn(0L);

        OperationsAttendeePageResponse page = service.getAttendees(
                OWNER, PERFORMANCE_ID, SCHEDULE_ID, "1024", null, null, null, null);

        assertThat(page.items()).isEmpty();
    }

    @Test
    void 와일드카드_검색어로_전체를_긁을_수_없다() {
        given(tickets.findAttendees(eq(SCHEDULE_ID), isNull(), isNull(), isNull(), isNull(),
                isNull(), any(Limit.class)))
                .willReturn(List.of());
        given(tickets.countAttendees(SCHEDULE_ID, null, null, null, null)).willReturn(0L);

        // '%' 만 넣으면 조건 자체가 없는 것과 같아야 한다 (검색어로 취급하지 않는다)
        service.getAttendees(OWNER, PERFORMANCE_ID, SCHEDULE_ID, "%", null, null, null, null);

        verify(tickets).countAttendees(SCHEDULE_ID, null, null, null, null);
    }

    @Test
    void 다른_회차의_티켓은_없는_티켓과_같은_오류다() {
        given(tickets.findAttendeeInSchedule(TICKET_ID, SCHEDULE_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.getAttendee(OWNER, PERFORMANCE_ID, SCHEDULE_ID, TICKET_ID))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getErrorCode())
                .isEqualTo(TicketErrorCode.TICKET_NOT_FOUND);
    }

    /* ── 재료 ───────────────────────────────────────────────── */

    private Area seatedArea() {
        Area area = mock(Area.class);
        given(area.getId()).willReturn(AREA_ID);
        lenient().when(area.getAreaCode()).thenReturn("A");
        lenient().when(area.getType()).thenReturn(AreaType.SEATED);
        lenient().when(area.isSeated()).thenReturn(true);
        lenient().when(area.getAreaX()).thenReturn(BigDecimal.ZERO);
        lenient().when(area.getAreaY()).thenReturn(BigDecimal.ZERO);
        lenient().when(area.getWidth()).thenReturn(BigDecimal.TEN);
        lenient().when(area.getHeight()).thenReturn(BigDecimal.TEN);
        lenient().when(area.getDisplayOrder()).thenReturn(1);
        return area;
    }

    private Area standingArea() {
        Area area = mock(Area.class);
        given(area.getId()).willReturn(STANDING_AREA_ID);
        lenient().when(area.getAreaCode()).thenReturn("S");
        lenient().when(area.getType()).thenReturn(AreaType.STANDING);
        lenient().when(area.isSeated()).thenReturn(false);
        lenient().when(area.getDisplayOrder()).thenReturn(2);
        return area;
    }

    private Seat seat(Long id, Area area, String rowLabel, int number) {
        Seat seat = mock(Seat.class);
        lenient().when(seat.getId()).thenReturn(id);
        lenient().when(seat.getArea()).thenReturn(area);
        lenient().when(seat.getRowLabel()).thenReturn(rowLabel);
        lenient().when(seat.getSeatNumber()).thenReturn(number);
        lenient().when(seat.getSeatX()).thenReturn(BigDecimal.valueOf(number * 10L));
        lenient().when(seat.getSeatY()).thenReturn(BigDecimal.TEN);
        return seat;
    }

    private PerformanceSeatRepository.SeatStatusView status(Long seatId, SeatBookingStatus status) {
        return new PerformanceSeatRepository.SeatStatusView() {
            @Override
            public Long getSeatId() {
                return seatId;
            }

            @Override
            public String getStatus() {
                return status.name();
            }
        };
    }

    private TicketRepository.SeatAssignment assignment(Long ticketId, Long areaId, Long seatId,
                                                       LocalDateTime checkedInAt) {
        return new TicketRepository.SeatAssignment() {
            @Override
            public Long getTicketId() {
                return ticketId;
            }

            @Override
            public Long getAreaId() {
                return areaId;
            }

            @Override
            public Long getSeatId() {
                return seatId;
            }

            @Override
            public LocalDateTime getCheckedInAt() {
                return checkedInAt;
            }
        };
    }

    /**
     * 명단 한 줄의 재료.
     *
     * <p>실제 {@code Ticket.issue} 는 얼굴을 요구한다 — 명단 조회는 생체정보와 무관하므로
     * 테스트에 얼굴을 끌어들이지 않고 필요한 값만 흉내 낸다.
     */
    private Ticket confirmedTicket(String name, String phone) {
        User user = mock(User.class);
        lenient().when(user.getName()).thenReturn(name);
        lenient().when(user.getNickname()).thenReturn("고양이집사");
        lenient().when(user.getPhone()).thenReturn(phone);

        Area area = mock(Area.class);
        lenient().when(area.getId()).thenReturn(AREA_ID);
        lenient().when(area.getAreaCode()).thenReturn("A");

        Ticket ticket = mock(Ticket.class);
        lenient().when(ticket.getId()).thenReturn(TICKET_ID);
        lenient().when(ticket.getUser()).thenReturn(user);
        lenient().when(ticket.getArea()).thenReturn(area);
        lenient().when(ticket.getSeat()).thenReturn(null);
        lenient().when(ticket.getStatus()).thenReturn(TicketStatus.CONFIRMED);
        lenient().when(ticket.getBookedAt()).thenReturn(LocalDateTime.of(2026, 9, 20, 10, 0));
        lenient().when(ticket.getCheckedInAt()).thenReturn(null);
        return ticket;
    }
}
