package com.teacat.server.performance.entity;

import java.time.LocalDateTime;
import java.util.Collection;

/**
 * 회차의 예매 오픈 상태 (API-206).
 *
 * DB 에 저장하는 값이 아니다. ticketing_status 와 티켓팅 시각·공연 일자를 조합해 매번 계산한다.
 * 클라이언트 시계를 믿을 수 없어 서버가 판단해 내려준다.
 */
public enum BookingOpenStatus {
    /** 티켓팅 시작 전 */
    BEFORE,
    /** 예매 가능 */
    OPEN,
    /** 매진 */
    SOLDOUT,
    /** 예매 종료 (공연이 지났거나 판매를 닫음) */
    CLOSED;

    /**
     * DB 판매 상태와 예매·공연 시각을 조합해 현재 예매 상태를 계산한다.
     *
     * <p>{@link TicketingStatus#SCHEDULED}는 예매 오픈 전용 영속 상태가 아니라
     * 정해진 시각에 자동으로 열릴 회차를 뜻한다. 따라서 SCHEDULED와 OPEN 모두
     * 오픈 시각이 지나면 실질 상태가 OPEN이다. SOLD_OUT과 CLOSED는 운영자가
     * 지정하는 예외 상태라 시간보다 우선한다.
     */
    public static BookingOpenStatus resolve(TicketingStatus ticketingStatus,
                                            LocalDateTime ticketingStartAt,
                                            LocalDateTime performanceDate,
                                            LocalDateTime now) {
        if (ticketingStatus == TicketingStatus.CLOSED || !performanceDate.isAfter(now)) {
            return CLOSED;
        }
        if (ticketingStatus == TicketingStatus.SOLD_OUT) {
            return SOLDOUT;
        }
        if (ticketingStartAt.isAfter(now)) {
            return BEFORE;
        }
        return OPEN;
    }

    /**
     * 공연 한 건의 <b>대표</b> 예매 상태 — 목록 카드의 칩에 쓴다.
     *
     * <p>회차들 중 "사용자가 지금 할 수 있는 것" 을 고른다. 하나라도 열려 있으면 그 공연은
     * 예매중이고, 열린 게 없으면 곧 열릴 것 → 매진 → 마감 순으로 내려간다.
     *
     * <p>🔴 <b>이 계산을 클라이언트로 내보내지 않는다.</b> 예전에는 목록 카드가
     * {@code ticketingStartAt <= now} 하나만 보고 "예매중" 을 찍었는데, 회차가 전부 마감이거나
     * 공연 날짜가 지나도 목록에는 계속 예매중으로 보였다. 들어가 보면 전부 마감이라
     * "왜 예매가 안 되냐" 는 문의가 됐다.
     *
     * @param scheduleStatuses 이 공연의 회차별 상태. 회차가 아직 없으면 빈 목록
     */
    public static BookingOpenStatus aggregate(Collection<BookingOpenStatus> scheduleStatuses,
                                              LocalDateTime ticketingStartAt,
                                              LocalDateTime now) {
        if (scheduleStatuses.contains(OPEN)) {
            return OPEN;
        }
        if (scheduleStatuses.contains(BEFORE)) {
            return BEFORE;
        }
        if (scheduleStatuses.contains(SOLDOUT)) {
            return SOLDOUT;
        }
        if (!scheduleStatuses.isEmpty()) {
            return CLOSED;
        }
        // 회차를 아직 등록하지 않은 공연. 볼 수 있는 건 티켓팅 시각뿐이다
        return ticketingStartAt.isAfter(now) ? BEFORE : CLOSED;
    }
}
