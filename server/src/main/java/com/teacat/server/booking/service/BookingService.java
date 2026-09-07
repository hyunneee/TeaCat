package com.teacat.server.booking.service;

import com.teacat.server.booking.dto.response.MyHoldResponse;
import com.teacat.server.booking.dto.response.SeatHoldResponse;
import com.teacat.server.booking.entity.PerformanceSeat;
import com.teacat.server.booking.entity.PerformanceSeatId;
import com.teacat.server.booking.entity.SeatBookingStatus;
import com.teacat.server.booking.exception.BookingErrorCode;
import com.teacat.server.booking.repository.PerformanceSeatRepository;
import com.teacat.server.booking.repository.PerformanceSeatRepository.TicketingWindow;
import com.teacat.server.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class BookingService {

    /** 1인 1매 제약을 강제하는 부분 유니크 인덱스 이름 (V20260903_1705 마이그레이션) */
    private static final String HELD_BY_UNIQUE_INDEX = "uq_performance_seats_held_by";

    /** performance_details.status 가 이 값일 때만 예매를 받는다 */
    private static final String TICKETING_STATUS_OPEN = "OPEN";

    private final PerformanceSeatRepository performanceSeatRepository;
    private final Duration holdDuration;

    public BookingService(PerformanceSeatRepository performanceSeatRepository,
            @Value("${booking.hold.duration}") Duration holdDuration) {
        this.performanceSeatRepository = performanceSeatRepository;
        this.holdDuration = holdDuration;
    }

    /**
     * 내가 선점 중인 좌석 목록. 1인 1매는 회차 단위 제약이므로 회차가 다르면 여러 건이 나올 수 있다.
     *
     * <p>조회이지만 만료 정리 UPDATE 가 앞에 있어 {@code readOnly} 가 아니다. 정리를 먼저 하지 않으면
     * 만료된 선점이 목록에 남아 결제 화면으로 흘러간다.
     */
    @Transactional
    public List<MyHoldResponse> getMyHolds(Long userId) {
        performanceSeatRepository.releaseAllExpiredHolds(userId);

        return performanceSeatRepository.findMyHolds(userId).stream()
                .map(MyHoldResponse::from)
                .toList();
    }

    /** 좌석 선점 */
    @Transactional
    public SeatHoldResponse holdSeat(Long performanceDetailId, Long seatId, Long userId) {
        TicketingWindow ticketingWindow = performanceSeatRepository
                .findTicketingWindow(performanceDetailId)
                .orElseThrow(() -> new BusinessException(
                        BookingErrorCode.PERFORMANCE_DETAIL_NOT_FOUND));

        PerformanceSeatId seatKey = new PerformanceSeatId(performanceDetailId, seatId);
        if (!performanceSeatRepository.existsById(seatKey)) {
            throw new BusinessException(BookingErrorCode.SEAT_NOT_FOUND);
        }

        validateTicketingOpen(ticketingWindow);

        // 만료 시각을 앱 시계로 계산한다. 응답에 만료 시각을 그대로 내려주려면 이 방식이 UPDATE 한 번으로 끝난다.
        // 트레이드오프: 만료 비교(held_until < now())는 DB 시계로 일어나므로 앱 서버와 DB 의 시계가 벌어지면
        // 실제 유효 시간이 그만큼 달라진다. NTP 동기화 환경에서는 무해한 수준이라 이 방식을 택했다.
        // 엄격하게 맞춰야 하면 SQL 에서 now() + make_interval(secs => :holdSeconds) 로 계산하고
        // 만료 시각을 재조회해야 한다 (쿼리 1회 추가).
        LocalDateTime heldUntil = LocalDateTime.now().plus(holdDuration);

        // ① 내가 쥐고 있던 만료된 선점을 먼저 해제한다. 이게 없으면 1인 1매 유니크 인덱스가
        //    만료된 행을 유효한 선점으로 보고, 아무 좌석도 없는 유저를 막아버린다.
        //    ② 보다 반드시 먼저 실행되어야 한다 (본인 것부터 정리한 뒤 새 좌석 시도).
        performanceSeatRepository.releaseExpiredHold(performanceDetailId, userId);

        // ② 새 좌석 선점. 만료된 남의 HELD 도 이 조건이 흡수한다
        int updated;
        try {
            updated = performanceSeatRepository.hold(performanceDetailId, seatId, userId, heldUntil);
        } catch (DataIntegrityViolationException e) {
            // 1인 1매 위반. ① 이 내 만료 선점을 정리해 주지만, 그 사이 다른 요청이 내 이름으로
            // 좌석을 잡는 경우가 남으므로 최종 방어선으로 유지한다.
            // 이 트랜잭션은 이미 abort 상태이므로 추가 조회 없이 바로 던진다
            if (isHeldByLimitViolation(e)) {
                throw new BusinessException(BookingErrorCode.SEAT_HOLD_LIMIT_EXCEEDED);
            }
            throw e;
        }

        if (updated == 0) {
            throw new BusinessException(resolveHoldFailure(seatKey, userId));
        }

        return new SeatHoldResponse(performanceDetailId, seatId, SeatBookingStatus.HELD, heldUntil,
                holdDuration.toSeconds());
    }

    /**
     * 좌석 선점 해제. 좌석을 변경하거나 예매를 중단할 때 호출한다.
     *
     * <p>권한 검사를 UPDATE 의 WHERE 에 넣어 처리한다. 소유자를 조회로 확인한 뒤 UPDATE 하면 그 사이에
     * 소유자가 바뀔 수 있는데, 이 방식은 남의 선점을 해제하는 것이 원자적으로 불가능하다.
     * 실패했을 때만 사유를 판별하므로 성공 경로는 쿼리 한 번이다.
     */
    @Transactional
    public void releaseSeat(Long performanceDetailId, Long seatId, Long userId) {
        int updated = performanceSeatRepository.releaseHold(performanceDetailId, seatId, userId);

        if (updated == 0) {
            throw new BusinessException(resolveReleaseFailure(
                    new PerformanceSeatId(performanceDetailId, seatId), userId));
        }
    }

    /**
     * 예매 오픈 여부 검증.
     *
     * <p>TODO 스키마에 예매 <b>종료</b> 시각 컬럼이 없어 종료는 회차 상태(SOLD_OUT / CLOSED)로만 판단한다.
     * 종료 시각이 추가되면 상한도 시각으로 검증한다.
     */
    private void validateTicketingOpen(TicketingWindow ticketingWindow) {
        if (!TICKETING_STATUS_OPEN.equals(ticketingWindow.getTicketingStatus())
                || ticketingWindow.getTicketingStartAt().isAfter(LocalDateTime.now())) {
            throw new BusinessException(BookingErrorCode.TICKETING_NOT_AVAILABLE);
        }
    }

    /**
     * 선점 실패 사유 판별. 실패 경로에서만 좌석을 다시 읽으므로 성공 경로에는 부담이 없다.
     * (직전 UPDATE 가 {@code clearAutomatically = true} 라 영속성 컨텍스트가 비워져 DB 를 다시 읽는다)
     */
    private BookingErrorCode resolveHoldFailure(PerformanceSeatId seatKey, Long userId) {
        PerformanceSeat seat = performanceSeatRepository.findById(seatKey).orElse(null);
        if (seat == null) {
            return BookingErrorCode.SEAT_NOT_FOUND;
        }

        return switch (seat.getStatus()) {
            case SOLD -> BookingErrorCode.SEAT_ALREADY_SOLD;
            // ② 가 만료된 HELD 를 흡수하므로 여기 남는 HELD 는 원칙적으로 "유효한 선점" 뿐이다.
            // 다만 ② 와 이 재조회 사이에 만료 시각이 지나는 좁은 창이 있어, 그때는 연장 불가(010)가
            // 아니라 경합에서 진 것으로 본다 (재시도하면 ② 가 흡수한다)
            case HELD -> !seat.isHeldExpired(LocalDateTime.now()) && userId.equals(seat.getHeldBy())
                    ? BookingErrorCode.SEAT_ALREADY_HELD_BY_ME
                    : BookingErrorCode.SEAT_ALREADY_HELD;
            // UPDATE 가 밀린 직후 그 선점이 해제된 경우. 이 요청은 경합에서 진 것이므로 선점 실패로 알린다
            case AVAILABLE -> BookingErrorCode.SEAT_ALREADY_HELD;
        };
    }

    /**
     * 해제 실패 사유 판별. UPDATE 가 0 행일 때만 호출된다.
     *
     * <p>남의 선점에 대해 403 을 주는 것은 정보 노출이 아니다 — 좌석의 선점 여부는 좌석 배치도로
     * 누구나 볼 수 있는 공개 정보다. 중요한 것은 <b>실제로 해제되지 않는다</b>는 점이고 그건 UPDATE 의
     * WHERE 가 보장한다.
     */
    private BookingErrorCode resolveReleaseFailure(PerformanceSeatId seatKey, Long userId) {
        PerformanceSeat seat = performanceSeatRepository.findById(seatKey).orElse(null);
        if (seat == null) {
            return BookingErrorCode.SEAT_NOT_FOUND;
        }

        return switch (seat.getStatus()) {
            // 결제까지 끝난 좌석에는 해제할 선점이 없다
            case SOLD -> BookingErrorCode.SEAT_HOLD_NOT_FOUND;
            // 남의 선점이면 권한 없음, 내 선점인데 UPDATE 가 실패했다면 만료된 것이다
            case HELD -> !userId.equals(seat.getHeldBy())
                    ? BookingErrorCode.NOT_SEAT_HOLDER
                    : BookingErrorCode.SEAT_HOLD_EXPIRED;
            // 이미 풀려 있다 (만료 흡수 또는 다른 요청이 먼저 해제)
            case AVAILABLE -> BookingErrorCode.SEAT_HOLD_NOT_FOUND;
        };
    }

    /** 무결성 위반이 1인 1매 인덱스 위반인지 (held_by FK 위반 등 다른 원인과 구분한다) */
    private boolean isHeldByLimitViolation(DataIntegrityViolationException e) {
        String message = NestedExceptionUtils.getMostSpecificCause(e).getMessage();
        return message != null && message.contains(HELD_BY_UNIQUE_INDEX);
    }
}
