package com.teacat.server.performance.entity;

/**
 * DB 의 performance_status ENUM 과 1:1 로 대응한다. 순서/이름을 바꾸려면 마이그레이션이 함께 필요하다.
 *
 * 전이 규칙 (API-264):
 * <pre>
 *   UPCOMING → ONGOING → ENDED
 *   UPCOMING → CANCELLED
 *   ONGOING  → CANCELLED
 * </pre>
 * ENDED · CANCELLED 는 끝 상태라 어디로도 바뀌지 않는다.
 * 이미 끝난 공연을 다시 진행 중으로 돌리면 예매·입장 흐름이 그 사이 기록과 어긋나기 때문이다.
 */
public enum PerformanceStatus {
    UPCOMING,
    ONGOING,
    ENDED,
    CANCELLED;

    public boolean canTransitionTo(PerformanceStatus target) {
        return switch (this) {
            case UPCOMING -> target == ONGOING || target == CANCELLED;
            case ONGOING -> target == ENDED || target == CANCELLED;
            case ENDED, CANCELLED -> false;
        };
    }
}
