package com.teacat.server.analytics.service;

import com.teacat.server.analytics.dto.response.DeploymentMarkerResponse;
import com.teacat.server.analytics.dto.response.MemberDailyPoint;
import com.teacat.server.analytics.dto.response.MemberSummaryResponse;
import com.teacat.server.analytics.dto.response.MemberTrendResponse;
import com.teacat.server.analytics.exception.AnalyticsErrorCode;
import com.teacat.server.analytics.repository.DailyActiveUserRepository;
import com.teacat.server.analytics.repository.DailyCountProjection;
import com.teacat.server.analytics.repository.DeploymentRepository;
import com.teacat.server.analytics.repository.MemberStatsRepository;
import com.teacat.server.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 어드민 대시보드의 회원 지표.
 *
 * <p>접근 제어는 {@code SecurityConfig} 의 {@code /admin/**} 규칙(ADMIN 전용)이 담당한다.
 *
 * <p>세는 대상은 일반 회원({@code role = 'USER'})뿐이다. 운영진 계정이 섞이면 우리 팀이
 * 대시보드를 열어본 것까지 접속자로 잡힌다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminAnalyticsService {

    /** 조회 기간 상한. 넘기면 점이 너무 많아 차트가 읽히지 않고 쿼리도 무거워진다 */
    public static final int MAX_DAYS = 365;

    private static final int WEEK_DAYS = 7;
    private static final int MONTH_DAYS = 30;

    private final MemberStatsRepository memberStatsRepository;
    private final DailyActiveUserRepository dailyActiveUserRepository;
    private final DeploymentRepository deploymentRepository;

    /**
     * 최근 {@code days} 일의 회원 추이 + 그 기간에 걸친 배포 마커.
     *
     * @param days 오늘을 포함한 일수 (2 ~ {@value #MAX_DAYS})
     */
    public MemberTrendResponse trend(int days) {
        if (days < 2) {
            throw new BusinessException(AnalyticsErrorCode.INVALID_PERIOD);
        }
        if (days > MAX_DAYS) {
            throw new BusinessException(AnalyticsErrorCode.PERIOD_TOO_LONG);
        }

        LocalDate to = LocalDate.now();
        LocalDate from = to.minusDays(days - 1L);

        Map<LocalDate, Long> signups = toMap(memberStatsRepository.countDailySignups(from, to));
        Map<LocalDate, Long> withdrawals = toMap(memberStatsRepository.countDailyWithdrawals(from, to));
        Map<LocalDate, Long> activeUsers = toMap(dailyActiveUserRepository.countDailyActive(from, to));

        // 누적 곡선의 출발점. 구간 안의 가입만 더하면 어떤 기간을 보든 0 에서 시작한다
        long runningTotal = memberStatsRepository.countMembersBefore(from);

        List<MemberDailyPoint> points = new ArrayList<>(days);

        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            long signedUp = signups.getOrDefault(date, 0L);
            long withdrawn = withdrawals.getOrDefault(date, 0L);
            runningTotal += signedUp - withdrawn;

            points.add(new MemberDailyPoint(
                    date,
                    signedUp,
                    withdrawn,
                    activeUsers.getOrDefault(date, 0L),
                    runningTotal));
        }

        List<DeploymentMarkerResponse> deployments = deploymentRepository.findInRange(from, to).stream()
                .map(DeploymentMarkerResponse::from)
                .toList();

        return new MemberTrendResponse(
                from,
                to,
                points,
                dailyActiveUserRepository.findEarliestVisitDate(),
                deployments);
    }

    /** 대시보드 상단 카드 숫자들 */
    public MemberSummaryResponse summary() {
        LocalDate today = LocalDate.now();
        LocalDate yesterday = today.minusDays(1);
        LocalDate weekAgo = today.minusDays(WEEK_DAYS - 1L);
        LocalDate monthAgo = today.minusDays(MONTH_DAYS - 1L);

        return new MemberSummaryResponse(
                memberStatsRepository.countActiveMembers(),
                memberStatsRepository.countActiveMembersWithFace(),
                sum(memberStatsRepository.countDailySignups(weekAgo, today)),
                sum(memberStatsRepository.countDailyWithdrawals(weekAgo, today)),
                dailyActiveUserRepository.countUniqueActive(today, today),
                dailyActiveUserRepository.countUniqueActive(yesterday, yesterday),
                dailyActiveUserRepository.countUniqueActive(weekAgo, today),
                dailyActiveUserRepository.countUniqueActive(monthAgo, today),
                dailyActiveUserRepository.countReturningActive(weekAgo, today),
                dailyActiveUserRepository.findEarliestVisitDate());
    }

    private Map<LocalDate, Long> toMap(List<DailyCountProjection> rows) {
        Map<LocalDate, Long> counted = new HashMap<>();

        for (DailyCountProjection row : rows) {
            counted.put(row.getBucket(), row.getTotal());
        }

        return counted;
    }

    private long sum(List<DailyCountProjection> rows) {
        return rows.stream().mapToLong(DailyCountProjection::getTotal).sum();
    }
}
