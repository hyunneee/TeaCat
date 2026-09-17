package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * application.yaml 의 queue.* 설정 — 가상 대기실 (server/QUEUE_DESIGN.md 5장).
 *
 * <p>정원은 코드가 아니라 <b>측정으로 정하는 값</b>이라 배포 설정에 둔다. 2026-09-17 재측정에서
 * 서버가 좌석 페이지 사용자 5,000명까지 처리했고, 그 값을 환경변수 {@code QUEUE_CAPACITY} 로 넣는다.
 * 서버를 늘리거나 캐시가 바뀌어 용량이 달라지면 값만 바꾸고 재기동한다.
 *
 * <p>회차별로 다르게 해야 하는 예외 상황은 관리자 API 가 Redis {@code queue:{sid}:config} 에
 * override 를 두고, 그 값이 있으면 여기 값보다 우선한다 (QueueRedisRepository 의 Lua 참고).
 *
 * @param capacity        좌석 페이지 동시 사용자 정원. 환경변수 {@code QUEUE_CAPACITY}
 * @param maxPerTick      한 틱에 들여보내는 최대 인원. 정원이 비어 있어도 이 수만큼만 — 좌석맵 첫 로드가 한꺼번에 몰리지 않게
 * @param ttl             입장 후 무활동 이탈 시간. 좌석·선점 API 를 부를 때마다 이만큼 연장된다
 * @param admitInterval   입장 관리자 주기. {@code @Scheduled} 문자열로도 쓰이므로 ISO-8601(PT1S) 로 적는다
 * @param admitterEnabled 입장 관리자 켬/끔. 테스트에서 끄고 {@code runOnce()} 를 직접 부른다
 */
@ConfigurationProperties(prefix = "queue")
public record QueueProperties(
        int capacity,
        int maxPerTick,
        Duration ttl,
        Duration admitInterval,
        boolean admitterEnabled
) {
    /** 락 TTL. 주기의 두 배 — 한 틱에 한 인스턴스만 돌되, 잡은 쪽이 죽어도 다음다음 틱에는 풀린다 */
    public Duration lockTtl() {
        return admitInterval.multipliedBy(2);
    }

    public long ttlSeconds() {
        return ttl.toSeconds();
    }
}
