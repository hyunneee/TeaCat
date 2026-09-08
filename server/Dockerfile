# syntax=docker/dockerfile:1.7
# 티캣 API 서버 (Spring Boot 4.1 / Java 21)
#   docker build -t teacat-server ./server

# ── 빌드 ──────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

COPY gradlew ./
COPY gradle gradle
RUN chmod +x gradlew

# 의존성을 먼저 받아둔다. src 만 바뀌면 이 레이어는 캐시되어 빌드가 빨라진다.
COPY build.gradle settings.gradle ./
RUN ./gradlew --no-daemon -q dependencies >/dev/null 2>&1 || true

COPY src src
# 테스트는 Testcontainers 를 써서 도커가 또 필요하다. CI 에서 따로 돌린다.
RUN ./gradlew --no-daemon -x test bootJar

# jar 를 레이어별로 분해한다. 코드만 바뀐 재배포에서 의존성 레이어를 다시 안 밀어도 된다.
RUN JAR=$(ls build/libs/*.jar | grep -v plain | head -1) \
    && java -Djarmode=tools -jar "$JAR" extract --layers --launcher --destination extracted

# ── 실행 ──────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN apk add --no-cache tzdata \
    && addgroup -S teacat && adduser -S teacat -G teacat
ENV TZ=Asia/Seoul

# 변경 빈도가 낮은 순서. 순서를 바꾸면 캐시 효과가 사라진다.
COPY --from=build --chown=teacat:teacat /workspace/extracted/dependencies/ ./
COPY --from=build --chown=teacat:teacat /workspace/extracted/spring-boot-loader/ ./
COPY --from=build --chown=teacat:teacat /workspace/extracted/snapshot-dependencies/ ./
COPY --from=build --chown=teacat:teacat /workspace/extracted/application/ ./

USER teacat
EXPOSE 8080

# 컨테이너 메모리 한도에 맞춰 힙을 잡는다. -Xmx 고정은 인스턴스 바뀔 때마다 손봐야 한다.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS org.springframework.boot.loader.launch.JarLauncher"]
