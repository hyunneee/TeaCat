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

ENV VITE_USE_MOCK=$VITE_USE_MOCK \
    VITE_ENABLE_DEVTOOLS=$VITE_ENABLE_DEVTOOLS \
    VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT \
    VITE_SENTRY_RELEASE=$VITE_SENTRY_RELEASE

# models(ONNX 내려받기) → tsc → vite build → wasm gzip
# 🔴 모델을 받아야 해서 빌드에 네트워크가 필요하다.
RUN npm run build

# 결과물만 남긴다. 이 이미지는 실행되지 않는다.
FROM alpine:3
COPY --from=build /app/dist /dist
