# syntax=docker/dockerfile:1.7
# 티캣 블록체인 서비스 (Express + Hardhat 산출물)
#
#   docker build -t teacat-blockchain ./blockchain
#
# 🔴 빌드 컨텍스트는 blockchain/ 이다. api/ 가 아니다.
#    api 가 "@teacat/contracts" 를 워크스페이스로 참조해서, api/ 만 잡으면 못 찾는다.
#
# 🔴 이 프로세스는 마스터 니모닉과 오퍼레이터 키를 쥔다. 포트를 publish 하지 말 것.

# ── 빌드 ──────────────────────────────────────────────
# alpine(musl) 대신 glibc 이미지. hardhat 이 받는 solc 네이티브 바이너리가 musl 에서 자주 깨진다.
FROM node:22-bookworm-slim AS builder
WORKDIR /build

COPY package.json package-lock.json ./
COPY contracts/package.json contracts/
COPY api/package.json api/

# manifest 의 scripts 를 걷어낸 뒤 설치한다.
#
# 🔴 --ignore-scripts 로는 워크스페이스의 prepare 가 안 막힌다 (npm 10).
#    contracts 의 prepare(hardhat compile)가 이 시점에 돌면 설정도 소스도 없어서 죽는다.
#    루트의 postinstall(setup:env)도 같이 사라진다 — 그게 돌면 무작위 니모닉이 든
#    .env 가 이미지에 구워진다.
RUN node -e "const fs=require('fs');for(const f of ['package.json','contracts/package.json','api/package.json']){const p=JSON.parse(fs.readFileSync(f,'utf8'));delete p.scripts;fs.writeFileSync(f,JSON.stringify(p,null,2))}" \
    && npm ci --ignore-scripts --no-audit --no-fund

# 소스를 덮어쓰면서 scripts 가 살아있는 진짜 manifest 로 돌아온다.
COPY tsconfig.base.json package.json ./
COPY contracts contracts
COPY api api

# contracts: hardhat compile → typechain 생성 → tsc,   api: tsc
RUN npm run build

# ── 운영 의존성만 다시 설치 ────────────────────────────
# hardhat/typechain 툴체인(수백 MB)을 최종 이미지에서 뺀다.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY contracts/package.json contracts/
COPY api/package.json api/
RUN node -e "const fs=require('fs');for(const f of ['package.json','contracts/package.json','api/package.json']){const p=JSON.parse(fs.readFileSync(f,'utf8'));delete p.scripts;fs.writeFileSync(f,JSON.stringify(p,null,2))}" \
    && npm ci --omit=dev --ignore-scripts --no-audit --no-fund

# ── 실행 ──────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache tzdata
ENV TZ=Asia/Seoul NODE_ENV=production

# node_modules/@teacat/contracts 는 ../contracts 로 걸린 심볼릭 링크다.
# 아래 복사와 디렉터리 구조가 맞아야 풀린다.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/contracts/package.json ./contracts/package.json
COPY --from=deps /app/api/package.json ./api/package.json

COPY --from=builder /build/contracts/dist ./contracts/dist
COPY --from=builder /build/api/dist ./api/dist
COPY --from=builder /build/contracts/deployments ./contracts/deployments

USER node
EXPOSE 4000

# ⚠️ 기본값 127.0.0.1 이면 컨테이너 밖(= server)에서 못 붙는다.
#    넓히는 대신 포트를 publish 하지 않는 것으로 막는다.
ENV HOST=0.0.0.0 PORT=4000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
    CMD wget -qO- http://127.0.0.1:4000/health >/dev/null || exit 1

CMD ["node", "api/dist/main.js"]
