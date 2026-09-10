# syntax=docker/dockerfile:1.7
# 프론트 빌드 전용 이미지.
#
# 서빙하지 않는다. dist/ 만 만들어서 담아두고, CI 가 docker cp 로 꺼내
# ~/teacat/frontend/<env>/ 에 넣는다. 서빙은 앞단 nginx 가 한다.
#
# 왜 컨테이너로 빌드하나: 젠킨스에 node 가 없다. 그리고 도커 빌드 컨텍스트는
# CLI 가 스트리밍하므로, 젠킨스 워크스페이스의 호스트 경로를 알 필요가 없다.

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# ⚠️ VITE_ 값은 빌드 시점에 번들에 박힌다. 런타임 환경변수로는 못 바꾼다.
#    기본값은 .env.production 의 현재 값과 같게 두었다. 백엔드 연동이 끝나면
#    CI 에서 --build-arg VITE_USE_MOCK=false 로 넘긴다.
ARG VITE_USE_MOCK=true
ARG VITE_ENABLE_DEVTOOLS=false

# 🔴 dev 배포도 `vite build --mode production` 으로 빌드한다. 그래서 .env.production 의
#    VITE_APP_ENV 를 그대로 쓰면 **dev 에서 난 에러가 대시보드에 production 으로 찍힌다.**
#    CI 가 DEPLOY_ENV(dev/prod)를 여기로 넘겨 구분한다. (Jenkinsfile '빌드: 프론트')
ARG VITE_SENTRY_ENVIRONMENT=production
# 어느 커밋에서 난 에러인지. CI 가 짧은 커밋 해시를 넣는다.
ARG VITE_SENTRY_RELEASE=

# 행동 분석 (Clarity). 비어 있으면 꺼진 채로 빌드된다 — 기본값이 빈 값인 이유다.
# 🔴 Clarity 에는 Sentry 의 environment 태그가 없다. dev/prod 는 **프로젝트를 따로**
#    만들어 CI 가 서로 다른 ID 를 넘긴다. 같은 ID 를 넘기면 히트맵이 섞인다.
ARG VITE_CLARITY_PROJECT_ID=

ENV VITE_USE_MOCK=$VITE_USE_MOCK \
    VITE_ENABLE_DEVTOOLS=$VITE_ENABLE_DEVTOOLS \
    VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT \
    VITE_SENTRY_RELEASE=$VITE_SENTRY_RELEASE \
    VITE_CLARITY_PROJECT_ID=$VITE_CLARITY_PROJECT_ID

# ── Sentry 소스맵 업로드 (vite.config.ts) ────────────────────────────
# 🔴 여기만 **VITE_ 가 아니다.** 붙이는 순간 토큰이 번들에 박혀 공개된다.
#    빌드할 때만 쓰고 결과물에는 흔적이 남지 않아야 하는 값이다.
#
# org·project 는 공개 값이라 기본값으로 박아 둔다. 토큰만 CI 가 넘긴다.
# 토큰이 비면 소스맵을 만들지도, 올리지도 않는다 (예전과 똑같이 동작).
ARG SENTRY_ORG=vitamin7
ARG SENTRY_PROJECT=teacat
ARG SENTRY_AUTH_TOKEN=
ENV SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT

# models(ONNX 내려받기) → tsc → vite build(+소스맵 업로드) → wasm gzip
# 🔴 모델과 소스맵 업로드 때문에 빌드에 네트워크가 필요하다.
#
# ⚠️ 토큰을 ENV 로 굳히지 않고 이 RUN 한 줄에서만 쓴다. 최종 이미지는
#    `FROM alpine:3` 로 새로 시작해 dist 만 복사하므로 배포 이미지에는 남지 않는다.
#    (BuildKit 의 `--mount=type=secret` 이 정석이지만 젠킨스에 buildx 가 없다 —
#     Jenkinsfile 의 DOCKER_BUILDKIT 주석 참고. 붙이면 그때 이 줄을 바꿔라)
RUN SENTRY_AUTH_TOKEN="$SENTRY_AUTH_TOKEN" npm run build

# 🔴 소스맵이 배포본에 섞여 나가면 전체 소스가 공개된다. vite.config.ts 가
#    업로드 직후 지우지만, 설정이 되돌려졌을 때를 대비해 여기서 한 번 더 막는다.
RUN find /app/dist -name '*.map' -type f -print -delete

# 결과물만 남긴다. 이 이미지는 실행되지 않는다.
FROM alpine:3
COPY --from=build /app/dist /dist
