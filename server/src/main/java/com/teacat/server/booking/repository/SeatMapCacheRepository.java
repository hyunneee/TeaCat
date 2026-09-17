package com.teacat.server.booking.repository;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.teacat.server.booking.dto.response.ScheduleSeatMapResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.util.function.Supplier;

/**
 * 좌석맵 응답의 초 단위 스냅샷 캐시.
 *
 * <p><b>무엇을 위한 캐시인가.</b> 좌석 선택 화면은 3초 주기로 폴링한다. 한 회차를 보는 사람이
 * U 명이면 초당 {@code U/3} 건이 들어오고 <b>전부 같은 응답</b>을 요구한다. 그때마다 쿼리 4개
 * (그중 둘은 좌석 수만큼의 행)를 다시 돌 이유가 없다. 1초 스냅샷을 재사용해 DB 조회를
 * <b>회차당 초당 1회</b>로 고정한다 — 접속자 수와 무관해진다.
 *
 * <p>즉 "데이터를 오래 재사용" 하는 캐시가 아니라 <b>같은 순간에 몰린 동일 요청을 접는</b>
 * 장치다. 그래서 좌석 상태가 자주 바뀌어도 효과가 줄지 않는다.
 *
 * <p>🔴 <b>무효화하지 않는다.</b> 선점·판매마다 캐시를 지우면 오픈 피크에 캐시가 계속 비워져
 * DB 조회가 {@code 쓰기 횟수 + 1}/초가 된다 (매진 직전 초당 170회 수준). TTL 만으로 두면
 * 쓰기 빈도와 무관하게 초당 1회다. 그래서 여기에는 evict 메서드가 <b>없다.</b>
 *
 * <p>정합성이 나빠지지 않는다. 응답이 최대 1초 묵지만 화면은 어차피 3초 주기로 묻기 때문에,
 * "화면엔 고를 수 있는데 선점 API 는 거절하는" 기존 3초 창이 오히려 1초로 좁아진다.
 * 본인이 방금 선점한 좌석만 1초 늦게 보이는데, 그건 선점 응답으로 프론트가 그 좌석 한 칸을
 * 직접 갱신해 메운다 (client {@code useSeatHold}).
 *
 * <p><b>Redis 가 아닌 이유.</b> 이 캐시가 없애려는 것이 요청당 반복 작업인데, Redis 에 두면
 * 그 요청들이 전부 네트워크 왕복과 좌석 수만큼의 JSON 역직렬화를 다시 한다 — DB 부하는
 * 줄지만 앱의 지연과 CPU 는 거의 그대로다. 게다가 서버는 한 번에 한 프로세스만 트래픽을
 * 받는다(운영은 블루-그린이고 nginx 가 한쪽으로만 보낸다). 공유할 상대가 없다.
 * 여러 대가 동시에 서비스하게 되면 이 클래스만 Redis 구현으로 갈아끼우면 된다 —
 * 그래서 캐시 접근을 서비스에서 떼어 여기 둔다.
 */
@Repository
public class SeatMapCacheRepository {

    private final Cache<Key, ScheduleSeatMapResponse> cache;

    public SeatMapCacheRepository(
            @Value("${booking.seat-map.cache.ttl}") Duration ttl,
            @Value("${booking.seat-map.cache.max-entries}") long maxEntries) {
        this.cache = Caffeine.newBuilder()
                // expireAfterAccess 가 아니라 Write 다. 계속 조회되는 인기 회차의 스냅샷이
                // 영원히 살아남으면 그 회차만 갱신되지 않는다
                .expireAfterWrite(ttl)
                // 좌석 1만 석 스냅샷이 1~2MB 라 상한이 없으면 힙을 먹는다.
                // 동시에 예매가 열린 회차는 많지 않아 넘칠 일이 드물고, 넘쳐도 미스가 늘 뿐이다
                .maximumSize(maxEntries)
                // 적중률을 지표로 보기 위한 것. 이것이 없으면 캐시가 실제로 먹고 있는지
                // 확인할 방법이 없다 (Micrometer 연동은 아직 안 붙였다)
                .recordStats()
                .build();
    }

    /**
     * 캐시에 살아 있는 스냅샷이 있으면 그것을, 없으면 {@code loader} 로 만들어 캐시에 넣고 반환한다.
     *
     * <p>🔴 {@code loader} 는 <b>같은 키에 대해 동시에 한 번만</b> 실행된다 (Caffeine 의
     * {@code get(key, mappingFunction)} 계약). TTL 이 만료된 직후 수백 건이 동시에 들어와도
     * DB 로 가는 것은 한 건이고 나머지는 그 결과를 기다린다. 직접 만든
     * {@code ConcurrentHashMap} 으로는 이 몰림을 따로 막아야 하는데, 그것이 Caffeine 을 쓰는
     * 이유다.
     *
     * <p>{@code loader} 가 예외를 던지면 그대로 전파되고 <b>아무것도 캐시되지 않는다.</b>
     * 없는 회차에 대한 실패가 1초간 굳지 않는다.
     *
     * @param areaId 특정 구역만 조회할 때. null(전 구역)도 키의 일부다 — 응답 내용이 다르다
     */
    public ScheduleSeatMapResponse get(Long scheduleId, Long areaId,
            Supplier<ScheduleSeatMapResponse> loader) {
        return cache.get(new Key(scheduleId, areaId), key -> loader.get());
    }

    /** 회차 + 구역. {@code areaId} 가 null 이면 전 구역 응답을 가리킨다 (record 의 equals 가 null 을 다룬다) */
    private record Key(Long scheduleId, Long areaId) {
    }
}
