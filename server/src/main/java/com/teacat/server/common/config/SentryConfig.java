package com.teacat.server.common.config;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import io.sentry.Sentry;
import io.sentry.logback.SentryAppender;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;

/**
 * 에러 리포팅(Sentry) 연결.
 *
 * <p>Prometheus/Grafana 는 <b>"몇 건 터졌나"</b>를 보여준다. 이건 <b>"무엇이 왜 터졌나"</b> —
 * 스택트레이스와 그때의 로그를 보여준다. 둘은 대체재가 아니라 짝이다.
 *
 * <h2>🔴 왜 자동설정(스타터)을 쓰지 않는가</h2>
 * {@code sentry-spring-boot-starter-jakarta:8.16.0} 은 <b>스프링 부트 4 에서 뜨지 않는다.</b>
 * 내부의 {@code SentrySpanRestClientConfiguration} 이
 * {@code org.springframework.boot.web.client.RestClientCustomizer} 를 참조하는데,
 * 부트 4 에서 {@code org.springframework.boot.restclient} 로 옮겨간 클래스다.
 * 자동설정 조건을 읽는 단계에서 {@code NoClassDefFoundError} 가 나고,
 * <b>애플리케이션 컨텍스트가 통째로 뜨지 않는다.</b> (조건부 로딩으로 우회되지 않는다)
 *
 * <p>그래서 자동설정 없이 <b>로그백 어펜더 하나만</b> 붙인다.
 * Sentry 가 부트 4 를 지원하면 이 클래스를 지우고 스타터로 갈아타면 된다.
 *
 * <h2>무엇이 올라가나</h2>
 * 루트 로거에 어펜더를 달아 <b>{@code ERROR} 로그를 이벤트로</b> 보낸다.
 * {@code GlobalExceptionHandler} 의 {@code log.error("Unexpected error: ", e)} 가 그대로 잡히고,
 * 컨트롤러 밖(필터 체인·스케줄러·비동기)에서 난 에러도 ERROR 로 찍히기만 하면 함께 올라간다.
 * {@code WARN} 이하는 이벤트로 만들지 않고 <b>빵부스러기(breadcrumb)</b>로만 붙어서,
 * 에러가 났을 때 "직전에 무슨 일이 있었는지"를 보여준다.
 *
 * <p>비즈니스 예외({@code BusinessException})는 올라가지 않는다. 좌석 선점 실패처럼
 * <b>정상 동작</b>이라 {@code WARN} 도 아닌 카운터로만 세고 있기 때문이다.
 * 그건 Grafana 가 볼 몫이다.
 *
 * <h2>🔴 생체정보</h2>
 * 자동설정을 쓰지 않으므로 <b>HTTP 요청 본문이 이벤트에 실리지 않는다.</b>
 * 얼굴 임베딩({@code POST /users/me/face})·비밀번호·결제 정보가 새어 나갈 경로가 없다.
 * 나중에 스타터나 서블릿 연동을 붙이게 되면 <b>반드시</b> 요청 본문 수집을 끄고 시작해라.
 */
@Configuration
@Slf4j
public class SentryConfig {

    private final SentryProperties properties;
    private SentryAppender appender;

    public SentryConfig(SentryProperties properties) {
        this.properties = properties;
        init();
    }

    private void init() {
        if (!properties.enabled()) {
            log.info("Sentry DSN 이 비어 있어 에러 리포팅을 켜지 않습니다.");
            return;
        }

        Sentry.init(options -> {
            options.setDsn(properties.dsn());
            options.setEnvironment(properties.environment());
            options.setRelease(properties.release());

            // 🔴 켜면 IP·사용자 정보가 기본으로 실려 간다.
            options.setSendDefaultPii(false);

            // 성능 추적은 끈다. 지연·처리량은 이미 Prometheus 가 히스토그램으로 보고 있고,
            // 여기서 또 재면 할당량만 태운다. (application.yaml 의 management 블록)
            options.setTracesSampleRate(0.0);
        });

        // 루트 로거에 어펜더를 단다. logback-spring.xml 을 만들지 않는 이유는,
        // 부트 4 가 기본 로그 설정을 XML 이 아니라 코드(DefaultLogbackConfiguration)로
        // 들고 있어서, XML 을 두는 순간 콘솔 로그 포맷을 우리가 떠안게 되기 때문이다.
        LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();

        SentryAppender sentryAppender = new SentryAppender();
        sentryAppender.setName("SENTRY");
        sentryAppender.setContext(context);
        // 이벤트(=이슈)로 만들 최소 레벨
        sentryAppender.setMinimumEventLevel(Level.ERROR);
        // 이벤트에 붙일 직전 로그의 최소 레벨
        sentryAppender.setMinimumBreadcrumbLevel(Level.INFO);
        sentryAppender.start();

        context.getLogger(ch.qos.logback.classic.Logger.ROOT_LOGGER_NAME).addAppender(sentryAppender);
        this.appender = sentryAppender;

        log.info("Sentry 에러 리포팅을 켰습니다. environment={}, release={}",
                properties.environment(), properties.release());
    }

    /**
     * 종료할 때 큐에 남은 이벤트를 보내고 정리한다.
     *
     * <p>이게 없으면 <b>배포 직전에 난 에러가 사라진다.</b> 컨테이너가 내려가면서
     * 아직 전송 안 된 이벤트를 들고 죽기 때문이다. 정작 그때 난 에러가 제일 궁금하다.
     */
    @PreDestroy
    public void shutdown() {
        if (appender != null) {
            appender.stop();
        }
        if (properties.enabled()) {
            Sentry.close();
        }
    }
}
