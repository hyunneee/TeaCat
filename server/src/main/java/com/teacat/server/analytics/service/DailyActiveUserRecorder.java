package com.teacat.server.analytics.service;

import com.teacat.server.analytics.repository.DailyActiveUserRepository;
import com.teacat.server.analytics.repository.DailyVisitCacheRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * 하루 접속 기록.
 *
 * <p>🔴 <b>여기서 나는 어떤 예외도 요청을 실패시키면 안 된다.</b> 통계를 못 남긴 것과
 * 사용자가 티켓을 못 산 것은 비교할 일이 아니다. Redis 가 죽든 DB 가 잠기든
 * 로그만 남기고 넘어간다.
 *
 * <p>그래서 트랜잭션 경계는 저장소 메서드 안에 있다({@code @Transactional} 이 거기 붙어 있다).
 * 이 메서드에 트랜잭션을 걸고 안에서 예외를 삼키면, 롤백 표시만 된 채 커밋 시점에
 * {@code UnexpectedRollbackException} 이 터져 나와 결국 요청이 죽는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DailyActiveUserRecorder {

    private final DailyVisitCacheRepository visitCache;
    private final DailyActiveUserRepository dailyActiveUserRepository;

    /**
     * 이 회원의 오늘 접속을 기록한다. 오늘 이미 기록됐으면 아무 일도 하지 않는다.
     *
     * @param userId 인증된 회원 ID
     */
    public void record(Long userId) {
        LocalDate today = LocalDate.now();

        try {
            if (!visitCache.markFirstVisit(userId, today)) {
                return;
            }

            dailyActiveUserRepository.recordVisit(userId, today);
        } catch (Exception e) {
            // 통계는 부수적이다. 여기서 막히면 그날 그 사람이 한 명 덜 세어질 뿐이다
            log.warn("접속 기록에 실패했습니다. userId={}, date={}", userId, today, e);
        }
    }
}
