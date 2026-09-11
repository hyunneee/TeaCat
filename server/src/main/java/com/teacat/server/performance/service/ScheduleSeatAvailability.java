package com.teacat.server.performance.service;

import com.teacat.server.booking.repository.PerformanceSeatRepository;
import com.teacat.server.booking.repository.PerformanceSeatRepository.SeatCountView;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * "이 회차, 좌석이 다 팔렸나?"
 *
 * <p>매진 판정이 필요한 곳이 넷이다 — 공연 목록의 대표 상태, 공연 상세의 회차 목록,
 * 회차 단건, 예매 오픈 상태 조회. 네 곳이 각자 세면 기준이 갈라지고, 실제로 갈라지면
 * <b>목록에서는 예매중인데 들어가면 매진</b> 같은 어긋남이 생긴다. 그래서 여기 하나로 모은다.
 *
 * <p>회차 상태({@code performance_details.status})의 SOLD_OUT 은 운영자가 손으로 바꾸는
 * 값이라 여기서 보지 않는다. 좌석을 세는 것이 진실이다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ScheduleSeatAvailability {

    private final PerformanceSeatRepository performanceSeatRepository;

    /**
     * 좌석이 바닥난 회차의 ID.
     *
     * <p>좌석을 아직 만들지 않은 회차는 <b>담기지 않는다</b>. 쿼리 결과에 아예 없고
     * (GROUP BY), 그건 매진이 아니라 준비 중이다.
     *
     * @param scheduleIds 비어 있으면 쿼리하지 않는다 — {@code IN ()} 은 SQL 문법 오류다
     */
    public Set<Long> findSoldOut(Collection<Long> scheduleIds) {
        if (scheduleIds.isEmpty()) {
            return Set.of();
        }

        return performanceSeatRepository.findSeatCounts(scheduleIds).stream()
                .filter(count -> count.getTotalCount() > 0 && count.getAvailableCount() == 0)
                .map(SeatCountView::getScheduleId)
                .collect(Collectors.toSet());
    }

    /** 회차 하나만 볼 때 */
    public boolean isSoldOut(Long scheduleId) {
        return !findSoldOut(Set.of(scheduleId)).isEmpty();
    }
}
