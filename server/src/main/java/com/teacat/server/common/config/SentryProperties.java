package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application.yaml 의 sentry.* 설정.
 *
 * <p>{@code dsn} 이 비어 있으면 <b>Sentry 를 아예 켜지 않는다.</b> 로컬에서 아무것도
 * 설정하지 않아도 그냥 뜨고, 팀원 노트북에서 난 에러가 대시보드를 채우지 않는다.
 *
 * <p>🔴 서버 DSN 은 프론트 DSN 과 <b>다른 값</b>이다. Sentry 프로젝트가 다르다.
 *    프론트 DSN 은 번들에 박히는 공개 값이지만, 서버 DSN 은 굳이 노출할 이유가 없으므로
 *    저장소에 두지 않고 {@code docker/.env.dev} 의 {@code SENTRY_DSN} 으로 주입한다.
 *
 * @param dsn         Sentry 프로젝트 주소. 비면 비활성
 * @param environment 대시보드에서 dev/prod 를 가르는 태그
 * @param release     어느 배포에서 난 에러인지. CI 가 커밋 해시를 넣어주면 가장 좋다
 */
@ConfigurationProperties(prefix = "sentry")
public record SentryProperties(String dsn, String environment, String release) {

    public boolean enabled() {
        return dsn != null && !dsn.isBlank();
    }
}
