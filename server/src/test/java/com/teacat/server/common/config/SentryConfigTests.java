package com.teacat.server.common.config;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import io.sentry.Sentry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Sentry 배선 확인.
 *
 * <p>이 테스트가 지키는 것은 <b>"DSN 이 없으면 아무 일도 없어야 한다"</b>는 규칙이다.
 * 로컬·CI 는 DSN 없이 도는데, 여기서 조용히 실패하지 않고 예외라도 나면
 * 전체 테스트가 Sentry 때문에 깨진다.
 *
 * <p>실제 전송은 확인하지 않는다 — 그러려면 네트워크와 진짜 프로젝트가 필요하고,
 * 테스트가 대시보드를 더럽힌다.
 */
class SentryConfigTests {

    private SentryConfig config;

    @AfterEach
    void tearDown() {
        if (config != null) {
            config.shutdown();
            config = null;
        }
        Sentry.close();
    }

    private Logger rootLogger() {
        LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
        return context.getLogger(Logger.ROOT_LOGGER_NAME);
    }

    @Test
    @DisplayName("DSN 이 비어 있으면 Sentry 를 켜지 않고 어펜더도 달지 않는다")
    void dsn이_없으면_켜지지_않는다() {
        config = new SentryConfig(new SentryProperties("", "local", "teacat-server@test"));

        assertThat(Sentry.isEnabled()).isFalse();
        assertThat(rootLogger().getAppender("SENTRY")).isNull();
    }

    @Test
    @DisplayName("DSN 이 null 이어도 터지지 않는다")
    void dsn이_null이어도_터지지_않는다() {
        config = new SentryConfig(new SentryProperties(null, "local", "teacat-server@test"));

        assertThat(Sentry.isEnabled()).isFalse();
    }

    @Test
    @DisplayName("DSN 이 있으면 루트 로거에 어펜더가 붙는다")
    void dsn이_있으면_어펜더가_붙는다() {
        // 실제로 존재하지 않는 프로젝트다. 이벤트를 만들지 않으므로 아무 데도 나가지 않는다.
        config = new SentryConfig(new SentryProperties(
                "https://0123456789abcdef0123456789abcdef@o0.ingest.sentry.io/1",
                "test",
                "teacat-server@test"));

        assertThat(Sentry.isEnabled()).isTrue();
        assertThat(rootLogger().getAppender("SENTRY")).isNotNull();
    }

    @Test
    @DisplayName("종료하면 어펜더가 떨어지고 Sentry 도 닫힌다")
    void 종료하면_정리된다() {
        config = new SentryConfig(new SentryProperties(
                "https://0123456789abcdef0123456789abcdef@o0.ingest.sentry.io/1",
                "test",
                "teacat-server@test"));

        config.shutdown();
        config = null;

        assertThat(Sentry.isEnabled()).isFalse();
    }
}
