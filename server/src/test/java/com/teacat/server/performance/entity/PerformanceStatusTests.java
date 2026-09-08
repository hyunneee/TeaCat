package com.teacat.server.performance.entity;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

import static com.teacat.server.performance.entity.PerformanceStatus.CANCELLED;
import static com.teacat.server.performance.entity.PerformanceStatus.ENDED;
import static com.teacat.server.performance.entity.PerformanceStatus.ONGOING;
import static com.teacat.server.performance.entity.PerformanceStatus.UPCOMING;
import static org.assertj.core.api.Assertions.assertThat;

class PerformanceStatusTests {

    @ParameterizedTest
    @CsvSource({
            "UPCOMING, ONGOING",
            "UPCOMING, CANCELLED",
            "ONGOING, ENDED",
            "ONGOING, CANCELLED",
    })
    void 허용된_전이(PerformanceStatus from, PerformanceStatus to) {
        assertThat(from.canTransitionTo(to)).isTrue();
    }

    @ParameterizedTest
    @CsvSource({
            "UPCOMING, ENDED",
            "ONGOING, UPCOMING",
    })
    void 순서를_건너뛰거나_되돌리는_전이는_거절한다(PerformanceStatus from, PerformanceStatus to) {
        assertThat(from.canTransitionTo(to)).isFalse();
    }

    @ParameterizedTest
    @EnumSource(PerformanceStatus.class)
    void 같은_상태로의_전이는_거절한다(PerformanceStatus status) {
        assertThat(status.canTransitionTo(status)).isFalse();
    }

    @ParameterizedTest
    @EnumSource(PerformanceStatus.class)
    void 종료_취소는_끝_상태다(PerformanceStatus target) {
        assertThat(ENDED.canTransitionTo(target)).isFalse();
        assertThat(CANCELLED.canTransitionTo(target)).isFalse();
    }
}
