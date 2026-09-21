package com.teacat.server.performance.service;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.booking.entity.SeatBookingStatus;
import com.teacat.server.booking.repository.PerformanceSeatRepository;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.performance.dto.request.OperationsCheckInFilter;
import com.teacat.server.performance.dto.response.OperationsAttendeeDetailResponse;
import com.teacat.server.performance.dto.response.OperationsAttendeePageResponse;
import com.teacat.server.performance.dto.response.OperationsAttendeeResponse;
import com.teacat.server.performance.dto.response.OperationsSeatMapResponse;
import com.teacat.server.performance.entity.PerformanceArea;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceAreaRepository;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.stadium.entity.Area;
import com.teacat.server.stadium.entity.Seat;
import com.teacat.server.stadium.repository.SeatRepository;
import com.teacat.server.ticket.entity.Ticket;
import com.teacat.server.ticket.exception.TicketErrorCode;
import com.teacat.server.ticket.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 운영 콘솔의 <b>좌석·예매자</b> 화면이 부르는 조회.
 *
 * <p>담당 공연의 회차 하나를 놓고 "어느 자리가 팔렸나 · 누가 들어왔나 · 그 자리는 누구인가" 에
 * 답한다. 검표(입장 처리)는 하지 않는다 — 그건 입장 확인 화면({@code /admin/check-in})의 일이고,
 * 카메라와 넓은 좌석맵을 한 화면에 함께 올리지 않기로 했다.
 *
 * <h2>권한</h2>
 * <p>🔴 <b>역할 검사만으로는 부족하다.</b> {@code SecurityConfig} 는 ADMIN·PERFORMANCE 까지만
 * 걸러 주므로, 다른 주최자가 자기 토큰으로 남의 {@code performanceId} 를 넣을 수 있다. 그래서
 * 모든 조회가 {@link PerformanceOperatorAccess} 로 담당 공연인지 검사하고,
 * <b>회차→공연</b>·<b>티켓→회차</b> 의 연결까지 확인한다. 하나라도 빠지면 경로의 앞부분만 자기
 * 것으로 채우고 뒷부분에 남의 ID 를 넣는 우회가 열린다.
 *
 * <h2>개인정보</h2>
 * <p>좌석맵에는 이름·연락처를 싣지 않고, 명단·상세에서만 <b>가려서</b> 내려보낸다
 * ({@link AttendeeMasking}). 얼굴 임베딩과 QR 비밀값은 어느 응답에도 담지 않는다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PerformanceOperationsService {

    /** 명단 한 페이지 기본 크기. 화면이 값을 보내면 그걸 쓰고, 상한을 넘기면 자른다 */
    private static final int DEFAULT_PAGE_SIZE = 30;
    private static final int MAX_PAGE_SIZE = 100;

    private final PerformanceOperatorAccess access;
    private final PerformanceDetailRepository schedules;
    private final PerformanceAreaRepository performanceAreas;
    private final PerformanceSeatRepository performanceSeats;
    private final SeatRepository seats;
    private final TicketRepository tickets;

    /**
     * 회차 좌석맵 + 입장 집계.
     *
     * <p>세 곳에서 읽어 한 장으로 합친다 — 공연장 배치(좌표), 공연 구역 설정(등급·정원),
     * 회차 좌석 상태(예매·선점). 거기에 티켓의 입장 여부를 얹는다.
     *
     * <p>🔴 <b>공개 좌석맵의 캐시를 쓰지 않는다</b>({@code SeatMapService} 는 1초 스냅샷을
     * 모든 관람객과 공유한다). 운영 응답에는 티켓 번호가 있어 공유 캐시에 섞으면 안 되고,
     * 반대로 운영자가 새로고침할 때 남이 만든 스냅샷을 받을 이유도 없다.
     */
    public OperationsSeatMapResponse getSeatMap(AuthUser actor, Long performanceId, Long scheduleId) {
        PerformanceDetail schedule = requireSchedule(actor, performanceId, scheduleId);

        List<PerformanceArea> configured = performanceAreas.findAllByPerformanceId(performanceId);
        List<Long> areaIds = configured.stream().map(pa -> pa.getArea().getId()).toList();

        Map<Long, List<Seat>> seatsByArea = areaIds.isEmpty() ? Map.of()
                : seats.findByAreaIdIn(areaIds).stream()
                        .collect(Collectors.groupingBy(seat -> seat.getArea().getId()));

        /* 만료 판정은 SQL 안(DB 시계)에서 끝나서 온다 — 자바에서 비교하면 예매 화면과
           운영 화면이 같은 좌석을 다르게 말한다 (findEffectiveStatuses 주석) */
        Map<Long, SeatBookingStatus> statusBySeatId =
                performanceSeats.findEffectiveStatuses(scheduleId).stream()
                        .collect(Collectors.toMap(
                                PerformanceSeatRepository.SeatStatusView::getSeatId,
                                view -> SeatBookingStatus.valueOf(view.getStatus())));

        List<TicketRepository.SeatAssignment> assignments = tickets.findConfirmedSeatAssignments(scheduleId);

        /* 좌석에 앉은 티켓. 스탠딩 티켓은 좌석이 없어 여기 들어오지 않고 구역 집계에만 센다.
           🔴 같은 좌석에 유효한 티켓이 둘일 수는 없다(취소되지 않은 표는 한 장). 그래도
              merge 를 두는 이유는, 데이터가 어긋났을 때 500 으로 화면을 닫지 않기 위해서다 —
              운영 중에 화면이 멈추는 것이 더 나쁘다. 최신 표를 보여준다. */
        Map<Long, TicketRepository.SeatAssignment> bySeatId = assignments.stream()
                .filter(row -> row.getSeatId() != null)
                .collect(Collectors.toMap(TicketRepository.SeatAssignment::getSeatId,
                        Function.identity(),
                        (older, newer) -> newer.getTicketId() > older.getTicketId() ? newer : older));

        Map<Long, List<TicketRepository.SeatAssignment>> byAreaId = assignments.stream()
                .filter(row -> row.getAreaId() != null)
                .collect(Collectors.groupingBy(TicketRepository.SeatAssignment::getAreaId));

        List<OperationsSeatMapResponse.Area> areas = configured.stream()
                .map(pa -> toArea(pa,
                        seatsByArea.getOrDefault(pa.getArea().getId(), List.of()),
                        statusBySeatId,
                        bySeatId,
                        byAreaId.getOrDefault(pa.getArea().getId(), List.of())))
                .toList();

        int checkedIn = (int) assignments.stream().filter(row -> row.getCheckedInAt() != null).count();
        /* 선점(결제 진행 중)은 좌석 쪽에만 있는 상태다 — 아직 티켓이 없다.
           만료된 선점은 findEffectiveStatuses 가 **조회 결과에서만** AVAILABLE 로 계산해 준다
           (DB 행은 HELD 로 남고 여기서도 UPDATE 하지 않는다). 그 계산이 DB 시계 기준이므로
           여기서 앱 시계로 held_until 을 다시 비교하지 않는다. */
        int held = (int) statusBySeatId.entrySet().stream()
                .filter(entry -> entry.getValue() == SeatBookingStatus.HELD)
                .count();

        return new OperationsSeatMapResponse(
                performanceId,
                schedule.getPerformance().getTitle(),
                scheduleId,
                schedule.getPerformanceNum(),
                schedule.getPerformanceDate(),
                LocalDateTime.now(),
                new OperationsSeatMapResponse.Summary(
                        assignments.size(), checkedIn, assignments.size() - checkedIn, held),
                areas);
    }

    /** 예매자 명단. 검색어·구역·입장 상태로 거르고 티켓 번호 커서로 넘긴다 */
    public OperationsAttendeePageResponse getAttendees(AuthUser actor,
                                                      Long performanceId,
                                                      Long scheduleId,
                                                      String keyword,
                                                      Long areaId,
                                                      OperationsCheckInFilter filter,
                                                      String cursor,
                                                      Integer requestedSize) {
        requireSchedule(actor, performanceId, scheduleId);

        int size = pageSize(requestedSize);
        Boolean checkedIn = (filter == null ? OperationsCheckInFilter.ALL : filter).toCheckedIn();
        String pattern = likePattern(keyword);
        Long ticketIdKeyword = ticketIdOf(keyword);
        Long cursorId = parseCursor(cursor);

        List<Ticket> rows = tickets.findAttendees(
                scheduleId, areaId, checkedIn, pattern, ticketIdKeyword, cursorId, Limit.of(size + 1));
        boolean hasNext = rows.size() > size;
        List<Ticket> page = hasNext ? rows.subList(0, size) : rows;

        return new OperationsAttendeePageResponse(
                page.stream().map(PerformanceOperationsService::toAttendee).toList(),
                hasNext ? String.valueOf(page.getLast().getId()) : null,
                hasNext,
                tickets.countAttendees(scheduleId, areaId, checkedIn, pattern, ticketIdKeyword));
    }

    /**
     * 좌석·명단에서 고른 티켓 한 장.
     *
     * <p>🔴 <b>없는 티켓과 남의 회차 티켓을 같은 404 로 답한다.</b> 구분해 주면 번호를 하나씩
     * 넣어 보며 존재하는 티켓을 찾아낼 수 있다 (입장 확인의 {@code TICKET_005} 와 같은 규칙).
     */
    public OperationsAttendeeDetailResponse getAttendee(AuthUser actor,
                                                       Long performanceId,
                                                       Long scheduleId,
                                                       Long ticketId) {
        PerformanceDetail schedule = requireSchedule(actor, performanceId, scheduleId);

        Ticket ticket = tickets.findAttendeeInSchedule(ticketId, scheduleId)
                .orElseThrow(() -> new BusinessException(TicketErrorCode.TICKET_NOT_FOUND));

        String grade = performanceAreas.findAllByPerformanceId(performanceId).stream()
                .filter(pa -> pa.getArea().getId().equals(ticket.getArea().getId()))
                .map(PerformanceArea::getGrade)
                .findFirst()
                .orElse(null);

        return new OperationsAttendeeDetailResponse(
                toAttendee(ticket),
                performanceId,
                schedule.getPerformance().getTitle(),
                scheduleId,
                schedule.getPerformanceNum(),
                schedule.getPerformanceDate(),
                grade);
    }

    /**
     * 담당 공연의 회차인지 확인하고 회차를 돌려준다.
     *
     * <p>🔴 <b>순서가 중요하다.</b> 공연 권한을 먼저 보고 그다음에 회차를 읽는다. 회차를 먼저
     * 읽어 공연 ID 를 얻는 방식으로 짜면, 권한 없는 사람이 보낸 회차 ID 의 존재 여부가
     * 응답 차이로 새어 나간다.
     *
     * <p>회차가 없거나 <b>다른 공연의 회차</b>면 같은 오류다. 경로의 공연은 내 것으로 채우고
     * 회차만 남의 것으로 바꿔 넣는 우회를 여기서 막는다.
     */
    private PerformanceDetail requireSchedule(AuthUser actor, Long performanceId, Long scheduleId) {
        access.performance(actor, performanceId);

        PerformanceDetail schedule = schedules.findById(scheduleId)
                .orElseThrow(() -> new BusinessException(PerformanceErrorCode.SCHEDULE_NOT_FOUND));
        if (!Objects.equals(schedule.getPerformance().getId(), performanceId)) {
            throw new BusinessException(PerformanceErrorCode.SCHEDULE_NOT_FOUND);
        }
        return schedule;
    }

    private OperationsSeatMapResponse.Area toArea(PerformanceArea performanceArea,
                                                  List<Seat> areaSeats,
                                                  Map<Long, SeatBookingStatus> statusBySeatId,
                                                  Map<Long, TicketRepository.SeatAssignment> bySeatId,
                                                  List<TicketRepository.SeatAssignment> areaAssignments) {
        Area area = performanceArea.getArea();
        boolean seated = performanceArea.isSoldAsSeated();

        /* 🔴 스탠딩 구역은 좌석을 그리지 않는다. 스탠딩에도 정원만큼의 가상 좌석 행이 있지만
              좌표가 없어서, 뿌리면 도면 한구석에 겹쳐 쌓인 "없는 자리" 가 된다.
              정원·예매·입장 수와 명단으로만 다룬다 (OperationsSeatMapResponse.Area 주석). */
        List<OperationsSeatMapResponse.Seat> mapped = seated
                ? areaSeats.stream()
                        .sorted(Comparator.comparing(Seat::getRowLabel, Comparator.nullsLast(Comparator.naturalOrder()))
                                .thenComparingInt(Seat::getSeatNumber))
                        .map(seat -> toSeat(seat, statusBySeatId, bySeatId))
                        .toList()
                : List.of();

        int capacity = seated
                ? mapped.size()
                : (performanceArea.getMaxCnt() == null ? areaSeats.size() : performanceArea.getMaxCnt());
        int checkedIn = (int) areaAssignments.stream().filter(row -> row.getCheckedInAt() != null).count();

        return new OperationsSeatMapResponse.Area(
                area.getId(),
                area.getAreaCode(),
                performanceArea.getSaleType(),
                performanceArea.getGrade(),
                performanceArea.getPrice(),
                area.getAreaX(),
                area.getAreaY(),
                area.getWidth(),
                area.getHeight(),
                capacity,
                areaAssignments.size(),
                checkedIn,
                mapped);
    }

    /**
     * 좌석 한 자리의 상태.
     *
     * <p>🔴 <b>티켓이 좌석 상태보다 먼저다.</b> 입장 여부는 티켓에만 있고, 좌석 행은
     * "팔렸다"(SOLD)까지만 안다. 좌석 상태만 보면 입장 완료가 예매 완료로 보인다.
     *
     * <p>회차 좌석이 아직 생성되지 않았으면 상태 행이 없다 — 팔린 것도 잡힌 것도 아니므로
     * {@code BLOCKED} 다. 도면은 보이되 판매 대상이 아니라는 뜻이다({@code SeatMapService} 와 같은 규칙).
     */
    private OperationsSeatMapResponse.Seat toSeat(Seat seat,
                                                  Map<Long, SeatBookingStatus> statusBySeatId,
                                                  Map<Long, TicketRepository.SeatAssignment> bySeatId) {
        TicketRepository.SeatAssignment assignment = bySeatId.get(seat.getId());
        SeatBookingStatus booking = statusBySeatId.getOrDefault(seat.getId(), SeatBookingStatus.BLOCKED);

        OperationsSeatMapResponse.SeatState state;
        if (assignment != null) {
            state = assignment.getCheckedInAt() != null
                    ? OperationsSeatMapResponse.SeatState.CHECKED_IN
                    : OperationsSeatMapResponse.SeatState.BOOKED;
        } else {
            state = switch (booking) {
                case AVAILABLE -> OperationsSeatMapResponse.SeatState.AVAILABLE;
                case HELD -> OperationsSeatMapResponse.SeatState.HELD;
                /* 표가 없는데 SOLD 인 좌석 — 취소 직후 좌석이 아직 풀리지 않은 순간이다.
                   빈자리라고 말하면 운영자가 "팔렸는데 비었다" 로 읽으므로 예매로 둔다. */
                case SOLD -> OperationsSeatMapResponse.SeatState.BOOKED;
                case BLOCKED -> OperationsSeatMapResponse.SeatState.BLOCKED;
            };
        }

        return new OperationsSeatMapResponse.Seat(
                seat.getId(),
                seat.getRowLabel(),
                seat.getSeatNumber(),
                seat.getSeatX(),
                seat.getSeatY(),
                state,
                assignment == null ? null : assignment.getTicketId());
    }

    /** 🔴 이름·연락처는 여기서만 가려진다. 원본을 담은 응답을 만들 길을 두지 않는다 */
    private static OperationsAttendeeResponse toAttendee(Ticket ticket) {
        Seat seat = ticket.getSeat();

        return new OperationsAttendeeResponse(
                ticket.getId(),
                ticket.getArea().getId(),
                ticket.getArea().getAreaCode(),
                seat == null ? null : seat.getId(),
                seat == null ? null : seat.getRowLabel(),
                seat == null ? null : seat.getSeatNumber(),
                AttendeeMasking.name(ticket.getUser().getName()),
                ticket.getUser().getNickname(),
                AttendeeMasking.phone(ticket.getUser().getPhone()),
                ticket.getStatus(),
                ticket.getBookedAt(),
                ticket.getCheckedInAt());
    }

    private int pageSize(Integer requested) {
        if (requested == null || requested <= 0) return DEFAULT_PAGE_SIZE;
        return Math.min(requested, MAX_PAGE_SIZE);
    }

    /**
     * 검색어를 LIKE 패턴으로. 비었으면 null (조건을 걸지 않는다).
     *
     * <p>{@code %}·{@code _} 는 지운다. 사람 이름·닉네임에 쓰이지 않는 글자이고, 그대로 넘기면
     * 검색어 하나로 전체 명단을 긁는 패턴이 된다.
     */
    private String likePattern(String keyword) {
        if (keyword == null || keyword.isBlank()) return null;
        String cleaned = keyword.trim().replaceAll("[%_\\\\]", "");
        return cleaned.isEmpty() ? null : "%" + cleaned.toLowerCase() + "%";
    }

    /** 숫자만 넣었으면 티켓 번호로도 찾는다. 자리수가 넘치면 번호로 보지 않는다 */
    private Long ticketIdOf(String keyword) {
        if (keyword == null || !keyword.trim().matches("\\d{1,18}")) return null;
        return Long.valueOf(keyword.trim());
    }

    /** 커서는 마지막으로 받은 티켓 번호다. 값이 이상하면 첫 페이지로 다룬다 */
    private Long parseCursor(String cursor) {
        if (cursor == null || !cursor.trim().matches("\\d{1,18}")) return null;
        return Long.valueOf(cursor.trim());
    }
}
