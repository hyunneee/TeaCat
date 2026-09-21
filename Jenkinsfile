// 티캣 배포 파이프라인
//
//   dev    브랜치 → 개발 서버 (dev.teacat.site)
//   master 브랜치 → 운영 서버 (teacat.site)
//
// 젠킨스는 호스트 도커 소켓을 빌려 쓴다. 여기서 도는 docker 명령은 호스트에서
// 도는 것과 같다. ~/teacat 이 컨테이너에 같은 경로로 마운트돼 있어야 한다.
//
// 시크릿은 저장소에 없다. ~/teacat/.env.<env> 를 그대로 읽는다.
//
// ── 무중단 배포 (운영만) ──────────────────────────────────
// 운영 서버는 색이 둘이다 (prod-server-blue / prod-server-green). 한 번에 하나만 뜬다.
// 배포는 유휴 색을 새 이미지로 띄워 /actuator/health 가 UP 이 될 때까지 기다린 뒤,
// nginx 가 보는 한 줄(~/teacat/nginx/conf.d/prod-backend.inc)을 바꿔 reload 하고
// 옛 색을 멈춘다. 스프링이 뜨는 40~60초 동안 트래픽이 끊기지 않는다.
//
// 🔴 전환 전에 실패하면 nginx 를 건드리지 않는다 — 옛 색이 계속 받고 있으므로 그게 롤백이다.
//    전환까지 끝난 뒤 되돌리려면 두 가지를 함께 해야 한다 (옛 색은 지우지 않고 멈춰만 뒀다):
//      docker start prod-server-<옛색>
//      prod-backend.inc 의 set 줄을 옛색으로 바꾸고
//      docker exec nginx nginx -t && docker exec nginx nginx -s reload
//
// 🔴 마이그레이션은 **뒤로 호환되게** 써야 한다. 새 색이 기동하면서 Flyway 가 스키마를
//    올리는데, 그 순간 옛 색이 아직 옛 코드로 서비스 중이다. 컬럼을 지우거나 이름을
//    바꾸면 전환하는 동안 옛 색이 깨진다. 지우는 건 다음 배포에서 따로 한다.
//
// 🔴 blockchain 은 server 보다 **뒤에** 올린다. 부팅할 때 Spring 스키마를 검사하고
//    컬럼이 없으면 스스로 죽는데, 그 컬럼을 만드는 게 server 의 Flyway 라서다.
//    순서를 되돌리면 새 마이그레이션이 들어간 배포마다 서로를 기다리다 멈춘다.
//
// 전환하는 몇 초간 두 인스턴스가 함께 산다. 스케줄러가 그 사이 같은 건을 두 번 집을 수
// 있지만 **낭비일 뿐 위험하지 않다.** 확인하고 넘어온 것이라 적어 둔다 —
//   - 돈이 움직이는 둘은 DB 가 막는다. 경매 마감은 SELECT ... FOR UPDATE + ACTIVE 조건이라
//     두 번째 호출이 락을 기다렸다 false 를 받고 끝나고, 좌석 생성은 ON CONFLICT DO NOTHING
//     이다. 애플리케이션 락이 아니라 **DB 락이라 인스턴스가 몇 개든 유효하다.**
//   - 결제 복구(TicketOrderScheduler·TokenChargeScheduler)는 initial-delay 가 30초라
//     겹치는 10초 구간에 **아예 돌지 않는다.** 체인 확정 폴링도 20초다.
//   - 나머지는 조회이거나 체인 멱등키(photocardKey)로 막힌다.
// ShedLock 은 서버를 정말 여러 대로 늘릴 때 필요하다 (SchedulingConfig 주석:
// "조회·멱등 요청이라 위험하진 않지만 낭비다"). 블루-그린 때문에 할 일은 아니다.
//
// 개발(dev)은 그대로 단일 컨테이너다. 잠깐 끊겨도 되는 환경에 색을 둘 두면 메모리만 먹는다.
//
// ── 빌드 시간 ─────────────────────────────────────────────
// 세 이미지를 매번 다 빌드하면 t3.small 에서 5~8분이 걸린다. 대부분의 푸시는
// 한 서비스만 건드리므로 '변경 감지' 가 직전 성공 커밋과 비교해 바뀐 것만 빌드한다.
//
// 🔴 판단이 불확실하면 전부 빌드한다 — 첫 빌드, force push, 얕은 클론,
//    공용 파일(docker/·Jenkinsfile) 변경, 이미지 없음, 프론트 폴더 비어 있음.
//    빠른 것보다 맞는 게 먼저다. 안 만든 이미지로 배포하면 조용히 옛 버전이 뜬다.

pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()          // 같은 환경에 두 배포가 겹치면 컨테이너가 꼬인다
        timeout(time: 40, unit: 'MINUTES') // 프론트 첫 빌드가 오래 걸린다 (ONNX 모델 + wasm)
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    environment {
        DEPLOY_DIR = '/home/ubuntu/teacat'

        // 🔴 DOCKER_BUILDKIT 을 켜지 말 것. 젠킨스 이미지에 buildx 플러그인이 없어서
        //    (docker/jenkins/Dockerfile 이 docker-ce-cli 와 compose 플러그인만 설치한다)
        //    CLI 23+ 는 레거시 빌더로 폴백한다. 이 상태로 변수를 켜면
        //    "buildx component is missing or broken" 으로 빌드가 죽는다.
        //
        //    같은 이유로 Dockerfile 에 --mount=type=cache 를 쓸 수 없다.
        //    쓰려면 먼저 docker/jenkins/Dockerfile 에 docker-buildx-plugin 을 추가하고
        //    EC2 에서 젠킨스 이미지를 다시 빌드해야 한다. (빌드 #25 가 이걸로 실패했다)
    }

    stages {
        stage('환경 결정') {
            steps {
                script {
                    // Multibranch 면 BRANCH_NAME, 단일 Pipeline 이면 GIT_BRANCH 가 채워진다
                    def branch = env.BRANCH_NAME ?: env.GIT_BRANCH?.replaceFirst(/^origin\//, '')

                    def resolved = branch == 'master' ? 'prod'
                                 : branch == 'dev'    ? 'dev'
                                 : null

                    // 기능 브랜치가 실수로 배포되는 걸 막는다
                    if (!resolved) {
                        error("배포 대상 브랜치가 아닙니다: '${branch}'. master 또는 dev 만 배포합니다.")
                    }

                    env.DEPLOY_ENV = resolved
                    env.ENV_FILE   = "${DEPLOY_DIR}/.env.${resolved}"
                    env.COMPOSE    = "${DEPLOY_DIR}/docker-compose.${resolved}.yml"
                    env.TAG        = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    // 배포 마커에 쓴다 (post.success 의 recordDeployment)
                    env.DEPLOY_BRANCH = branch

                    echo "브랜치 ${branch} → ${resolved} 배포 (${env.TAG})"
                }
            }
        }

        stage('사전 점검') {
            steps {
                sh '''
                    set -e
                    # 시크릿은 저장소에 없다. 이것만 서버에 미리 있어야 한다.
                    test -r "$ENV_FILE" || { echo "$ENV_FILE 을 읽을 수 없습니다."; exit 1; }

                    # 🔴 여기서 보는 건 **워크스페이스의 원본**이지 $COMPOSE(=~/teacat/...)가 아니다.
                    #    $COMPOSE 는 아래 '설정 동기화' 가 저장소에서 복사해 만든다. 그걸 여기서
                    #    미리 요구하면 그 환경의 첫 배포가 영원히 실패한다 — 파일을 만드는 단계까지
                    #    가보지도 못한다. (개발은 파일이 이미 있어서 이 순서 문제가 드러나지 않았다)
                    REQUIRED="docker/docker-compose.$DEPLOY_ENV.yml docker/nginx/conf.d/$DEPLOY_ENV.conf"
                    # 🔴 `[ 조건 ] && 변수=...` 로 쓰지 말 것. dev 에서 조건이 거짓이면 그 줄의
                    #    종료코드가 1 이라 set -e 가 파이프라인을 여기서 죽인다.
                    if [ "$DEPLOY_ENV" = "prod" ]; then
                        # 블루-그린 전환 스위치의 첫 배포용 기본값 (docker/nginx/conf.d/prod.conf 가 include)
                        REQUIRED="$REQUIRED docker/nginx/conf.d/prod-backend.inc"
                    fi
                    for f in $REQUIRED; do
                        test -r "$f" || { echo "저장소에 $f 가 없습니다."; exit 1; }
                    done

                    # '설정 동기화' 가 conf 를 복사해 넣을 곳. cp 는 폴더가 없으면 실패한다.
                    test -d "$DEPLOY_DIR/nginx/conf.d" || {
                        echo "$DEPLOY_DIR/nginx/conf.d 폴더가 없습니다."
                        echo "docker-compose.proxy.yml 의 nginx 가 이 폴더를 마운트합니다."
                        exit 1
                    }
                    test -d "$DEPLOY_DIR/frontend/$DEPLOY_ENV" || {
                        echo "$DEPLOY_DIR/frontend/$DEPLOY_ENV 폴더가 없습니다."
                        echo "nginx 가 이 폴더를 마운트하고 있어야 합니다."
                        exit 1
                    }
                    docker network inspect teacat-net >/dev/null 2>&1 || {
                        echo "teacat-net 네트워크가 없습니다.  docker network create teacat-net"
                        exit 1
                    }
                    docker compose version >/dev/null
                '''
            }
        }

        stage('변경 감지') {
            steps {
                script {
                    // 직전 '성공' 커밋과 비교한다. 직전 빌드(실패 포함)와 비교하면
                    // 실패한 빌드에 들어 있던 변경이 영영 빌드되지 않고 넘어간다.
                    def prev = env.GIT_PREVIOUS_SUCCESSFUL_COMMIT

                    // 그 커밋이 이 워크스페이스에 실제로 있어야 diff 가 된다.
                    // 첫 빌드·force push·얕은 클론이면 없다.
                    def hasBase = prev && sh(
                        script: "git rev-parse --verify --quiet '${prev}^{commit}' >/dev/null",
                        returnStatus: true) == 0

                    if (!hasBase) {
                        echo "직전 성공 커밋을 쓸 수 없습니다 (${prev ?: '기록 없음'}). 전부 빌드합니다."
                    }

                    def files = hasBase
                        ? sh(script: "git diff --name-only '${prev}' HEAD", returnStdout: true).trim().tokenize('\n')
                        : []

                    def touched = { String prefix -> files.any { it.startsWith(prefix) } }

                    // Jenkinsfile 이 바뀌면 빌드 인자(MOCK 등)나 빌드 명령 자체가 바뀔 수 있다.
                    // 무엇이 영향받는지 알 수 없으므로 전부 빌드한다.
                    //
                    // docker/ 는 여기 넣지 않는다. compose·nginx conf·모니터링 설정 뿐이고
                    // 세 빌드 컨텍스트(./client, ./server, ./blockchain) 밖이라 이미지 내용에
                    // 영향이 없다. '설정 동기화'·'앱 배포'·'모니터링 배포' 가 이미지 재빌드 없이
                    // 반영한다. compose 에 서비스가 새로 생기면 아래 missing() 이 잡는다.
                    def wide = !hasBase || files.contains('Jenkinsfile')

                    def missing = { String image ->
                        sh(script: "docker image inspect ${image} >/dev/null 2>&1", returnStatus: true) != 0
                    }

                    // nginx 가 보는 폴더가 비어 있으면 이미지가 있어도 dist 를 다시 꺼내야 한다.
                    def frontEmpty = sh(
                        script: "test -s '${env.DEPLOY_DIR}/frontend/${env.DEPLOY_ENV}/index.html'",
                        returnStatus: true) != 0

                    env.BUILD_CLIENT = (wide || touched('client/')
                        || missing("teacat-client:${env.DEPLOY_ENV}-latest")
                        || frontEmpty) ? 'true' : 'false'

                    env.BUILD_SERVER = (wide || touched('server/')
                        || missing("teacat-server:${env.DEPLOY_ENV}")) ? 'true' : 'false'

                    env.BUILD_CHAIN = (wide || touched('blockchain/')
                        || missing("teacat-blockchain:${env.DEPLOY_ENV}")) ? 'true' : 'false'

                    def built = []
                    if (env.BUILD_CLIENT == 'true') built << 'client'
                    if (env.BUILD_SERVER == 'true') built << 'server'
                    if (env.BUILD_CHAIN  == 'true') built << 'blockchain'
                    env.BUILT_SUMMARY = built ? built.join(', ') : '없음 (재배포만)'

                    if (frontEmpty) {
                        echo "frontend/${env.DEPLOY_ENV} 가 비어 있어 프론트를 강제로 빌드합니다."
                    }
                    echo "변경 파일 ${files.size()}개 → 빌드 대상: ${env.BUILT_SUMMARY}"
                }
            }
        }

        stage('빌드: 프론트') {
            when { environment name: 'BUILD_CLIENT', value: 'true' }
            steps {
                sh '''
                    set -e
                    # 목업 스위치. 양쪽 환경 모두 아직 켜 둔다.
                    #
                    # 🔴 운영만 false 로 두면 배포본이 홈 화면부터 빈다.
                    #    서버에 아직 컨트롤러가 없는 경로가 남아 있기 때문이다
                    #    (/banners, /app/version, /schedules/*/seats, /me/tickets,
                    #     /me/nfts, /nfts, /payments/*, /holds/*, /resale/*).
                    #
                    #    지금 목업이 잡는 건 위 경로와 캡차뿐이다. 회원·인증·얼굴·공연 조회는
                    #    목업을 켜 둬도 실서버로 나간다 (client/src/mocks/index.ts).
                    #    위 경로의 백엔드가 붙는 대로 handlers 에서 지우고, 다 지워지면
                    #    이 줄을 MOCK=false 로 바꾼다.
                    MOCK=true

                    # 행동 분석 (Microsoft Clarity). **빈 값이면 꺼진 채로 빌드된다.**
                    #
                    # 🔴 Clarity 에는 Sentry 의 environment 태그가 없다. 그래서 dev/prod 를
                    #    가르는 방법이 **프로젝트를 따로 만드는 것**뿐이다. 같은 ID 를 양쪽에
                    #    넣으면 히트맵·퍼널이 섞여서 어느 환경 수치인지 분간이 안 된다.
                    #
                    # 🔴 ID 를 채우기 전에 대시보드에서 **설정 > 마스킹 > Strict** 를 먼저
                    #    바꿔야 한다. 기본값은 Balanced(숫자·이메일만 가림)이고, 마스킹 변경은
                    #    **소급 적용되지 않는다** — 그 사이 올라간 세션은 가려지지 않은 채 남는다.
                    #    (프로젝트 ID 는 공개 값이라 여기 적어도 된다. 데이터 내보내기 API
                    #     토큰은 전혀 다른 물건이고 절대 여기 두면 안 된다)
                    case "$DEPLOY_ENV" in
                        # teacat.site → Clarity 프로젝트 'teacat' (프로젝트 설정의 웹사이트
                        # URL 도 이 주소다). **실사용자가 어디서 막히는지 보려고 여기를 켠다** —
                        # dev 만 보면 표본이 팀원뿐이라 히트맵·퍼널이 통계적으로 무의미했다.
                        prod) CLARITY_ID="yfz2y32jxa" ;;

                        # 🔴 dev 는 **일부러 끈다.** 프로젝트가 하나뿐이라 양쪽을 같은 ID 로
                        #    보내면 dev 세션이 운영 히트맵·퍼널에 섞인다 (Clarity 에는 Sentry 의
                        #    environment 같은 태그가 없어서 나중에 갈라낼 수도 없다).
                        #    dev 도 보려면 Clarity 에서 프로젝트를 하나 더 만들어 여기 채운다.
                        *)    CLARITY_ID="" ;;
                    esac

                    # 이용 분석 (GA4). Clarity 와 판단이 **반대**다 — 지금 있는 속성이
                    # 운영(teacat.site) 것 하나뿐이라 prod 만 켠다.
                    #
                    # 🔴 dev 를 켜려면 GA 에서 **속성을 하나 더 만들어** 아래 dev 칸에 채워라.
                    #    운영 것을 그대로 쓰면 개발 중 클릭이 세션 수·이탈률·퍼널에 섞인다
                    #    (GA4 에도 Sentry 의 environment 같은 태그가 없다).
                    #
                    # 🔴 GA 콘솔에서 **향상된 측정 > 페이지 조회수 > "브라우저 기록 이벤트
                    #    기반 페이지 변경" 이 꺼져 있어야 한다.** 우리가 라우트마다 직접
                    #    보내므로(shared/lib/ga.ts) 켜 두면 화면 이동이 두 번씩 집계된다.
                    #    코드로는 못 끈다 — 사람이 대시보드에서 꺼야 한다.
                    #
                    # (측정 ID 는 스크립트 주소에 실리는 공개 값이라 여기 적어도 된다.
                    #  Data API 서비스 계정 키는 전혀 다른 물건이고 절대 여기 두면 안 된다)
                    case "$DEPLOY_ENV" in
                        prod) GA_ID="G-Y46EH6RRQM" ;;
                        *)    GA_ID="" ;;
                    esac

                    # 소스맵 업로드 토큰 (Sentry). 없으면 조용히 건너뛴다 —
                    # 예전처럼 난독화된 스택이 올라올 뿐, 배포가 실패하지는 않는다.
                    #
                    # 🔴 .env.dev/.env.prod 에 넣지 마라. 그 파일은 server 컨테이너가
                    #    env_file 로 통째로 읽어서, 빌드에만 쓰는 토큰이 런타임 컨테이너
                    #    환경에 남게 된다. 그래서 전용 파일을 따로 둔다.
                    #    dev/prod 가 같은 Sentry 프로젝트(teacat)라 파일도 하나다.
                    #
                    # 🔴 젠킨스 sh 는 `sh -xe` 로 돌아서 **모든 명령이 값까지 로그에 찍힌다.**
                    #    토큰을 만지는 동안만 추적을 끈다. 켠 뒤에 토큰 변수를 다시 쓰면
                    #    그 줄에서 그대로 새므로, 판단은 HAS_TOKEN 플래그로만 한다.
                    #    docker 에도 `--build-arg 이름` (값 없이) 으로 넘겨 환경에서 읽게 한다.
                    TOKEN_FILE="$DEPLOY_DIR/.sentry-auth-token"
                    set +x
                    if [ -r "$TOKEN_FILE" ]; then
                        SENTRY_AUTH_TOKEN=$(head -n 1 "$TOKEN_FILE" | tr -d '[:space:]')
                    else
                        SENTRY_AUTH_TOKEN=""
                    fi
                    export SENTRY_AUTH_TOKEN
                    if [ -n "$SENTRY_AUTH_TOKEN" ]; then HAS_TOKEN=yes; else HAS_TOKEN=no; fi
                    set -x

                    if [ "$HAS_TOKEN" = yes ]; then
                        echo "Sentry 소스맵을 업로드합니다 (release teacat-client@$TAG)."
                    else
                        echo "⚠️  $TOKEN_FILE 이 없어 소스맵 업로드를 건너뜁니다."
                        echo "    배포는 되지만 이슈 스택이 난독화된 채로 옵니다. 서버에서:"
                        echo "      echo '<토큰>' > $TOKEN_FILE && chmod 600 $TOKEN_FILE"
                        echo "    토큰은 Sentry > Settings > Auth Tokens 에서 발급합니다"
                        echo "    (범위: project:releases + org:read. DSN 과 전혀 다른 물건이다)."
                    fi

                    # -latest 는 '이 환경의 프론트 이미지가 있는가' 를 묻기 위한 고정 태그다.
                    # 커밋 태그($TAG)만 붙이면 변경 감지가 매번 "이미지 없음" 으로 본다.
                    #
                    # 🔴 VITE_SENTRY_RELEASE 와 소스맵을 올리는 release 이름은 **같아야** 한다.
                    #    vite.config.ts 가 이 값을 그대로 읽어 쓴다. 여기만 바꾸면 업로드는
                    #    초록불인데 이슈에는 계속 난독화된 스택이 뜬다 — 경고도 안 난다.
                    docker build \
                        -t "teacat-client:$DEPLOY_ENV-$TAG" \
                        -t "teacat-client:$DEPLOY_ENV-latest" \
                        --build-arg VITE_USE_MOCK=$MOCK \
                        --build-arg VITE_SENTRY_ENVIRONMENT=$DEPLOY_ENV \
                        --build-arg VITE_SENTRY_RELEASE=teacat-client@$TAG \
                        --build-arg VITE_CLARITY_PROJECT_ID=$CLARITY_ID \
                        --build-arg VITE_GA_MEASUREMENT_ID=$GA_ID \
                        --build-arg SENTRY_AUTH_TOKEN ./client
                '''
            }
        }

        stage('빌드: 서버') {
            when { environment name: 'BUILD_SERVER', value: 'true' }
            steps {
                sh '''
                    set -e
                    docker build -t "teacat-server:$DEPLOY_ENV" ./server
                '''
            }
        }

        stage('빌드: 블록체인') {
            when { environment name: 'BUILD_CHAIN', value: 'true' }
            steps {
                sh '''
                    set -e
                    docker build -t "teacat-blockchain:$DEPLOY_ENV" ./blockchain
                '''
            }
        }

        stage('프론트 배포') {
            // 프론트를 안 빌드했으면 dist 는 이미 폴더에 있고, 꺼낼 $TAG 이미지도 없다.
            when { environment name: 'BUILD_CLIENT', value: 'true' }
            steps {
                sh '''
                    set -e
                    # 빌드 이미지에서 dist 만 꺼내 nginx 가 보는 폴더에 덮어쓴다.
                    #
                    # 🔴 폴더를 통째로 갈아끼우면(mv) 안 된다. nginx 가 그 디렉터리를
                    #    바인드 마운트로 잡고 있어서, 새 폴더로 바꿔도 옛 것을 계속 본다.
                    #    내용만 덮어쓴다. 옛 해시 파일이 남지만, 이미 열려 있던 페이지가
                    #    자기 자산을 계속 받을 수 있어서 오히려 안전하다.
                    CID=$(docker create teacat-client:$DEPLOY_ENV-$TAG)
                    docker cp "$CID:/dist/." "$DEPLOY_DIR/frontend/$DEPLOY_ENV/"
                    docker rm "$CID" >/dev/null
                '''
            }
        }

        stage('설정 동기화') {
            steps {
                sh '''
                    set -e
                    # 저장소가 원본이다. EC2 에서 직접 고치면 여기서 덮어써진다.
                    #
                    # 🔴 cp 여야 한다. mv 로 갈아끼우면 파일 단위 바인드 마운트가 끊긴다
                    #    (컨테이너가 사라진 옛 파일을 계속 본다).
                    #
                    # 🔴 이 환경 것만 덮어쓴다. conf.d/*.conf 를 통째로 복사하면
                    #    dev 배포가 운영 nginx 설정까지 바꿔버린다.
                    cp -f "docker/nginx/conf.d/$DEPLOY_ENV.conf" "$DEPLOY_DIR/nginx/conf.d/"
                    cp -f "docker/docker-compose.$DEPLOY_ENV.yml" "$COMPOSE"

                    # 🔴 블루-그린 전환 스위치는 **cp -f 로 덮지 않는다.**
                    #    이 파일만은 저장소가 원본이 아니라 **서버의 현재 색이 정답**이다.
                    #    덮으면 배포마다 blue 로 되돌아가, green 이 떠 있는 상태에서
                    #    nginx 가 죽은 blue 를 가리켜 운영 전체가 502 가 된다.
                    #    없을 때만(=첫 배포) 저장소 기본값을 깔아 준다.
                    if [ "$DEPLOY_ENV" = "prod" ]; then
                        INC="$DEPLOY_DIR/nginx/conf.d/prod-backend.inc"
                        if [ ! -f "$INC" ]; then
                            cp "docker/nginx/conf.d/prod-backend.inc" "$INC"
                            echo "블루-그린 스위치를 새로 만들었습니다 ($INC)."
                        fi
                    fi

                    # nginx.conf 와 proxy.yml 은 양쪽 환경이 함께 쓴다.
                    # 자동으로 덮어쓰면 한쪽 배포가 다른 쪽을 건드리므로 알려만 준다.
                    for f in nginx/nginx.conf docker-compose.proxy.yml; do
                        src="docker/$f"; dst="$DEPLOY_DIR/$f"
                        [ -f "$src" ] || continue
                        if ! diff -q "$src" "$dst" >/dev/null 2>&1; then
                            echo "⚠️  공용 파일이 저장소와 다릅니다: $f"
                            echo "    두 환경에 모두 영향을 주므로 손으로 반영하세요."
                        fi
                    done
                '''
            }
        }

        stage('앱 배포 (개발)') {
            when { not { environment name: 'DEPLOY_ENV', value: 'prod' } }
            steps {
                script { env.SERVER_CONTAINER = "${env.DEPLOY_ENV}-server" }
                sh '''
                    set -e
                    # Sentry 이슈에 어느 배포에서 났는지를 붙인다. 프론트는 빌드 인자로 이미 넘기고 있고
                    # (VITE_SENTRY_RELEASE), 서버는 런타임 값이라 여기서 넘긴다.
                    #
                    # 🔴 셸 환경변수가 --env-file 보다 우선한다. 그래서 .env 를 안 고쳐도 덮어써진다.
                    #    이게 없으면 compose 기본값(teacat-server@prod)으로 고정돼, Sentry 에서
                    #    모든 배포의 이슈가 한 릴리스에 뭉쳐 "언제부터 터졌나" 를 알 수 없다.
                    export SENTRY_RELEASE="teacat-server@$TAG"

                    docker compose -f "$COMPOSE" --env-file "$ENV_FILE" up -d --remove-orphans
                '''
            }
        }

        // 운영은 컨테이너를 바꿔 끼우는 동안에도 트래픽이 끊기면 안 된다.
        // 유휴 색을 새 이미지로 띄워 /actuator/health 가 UP 이 된 뒤에야 nginx 를 돌린다.
        // 그 전에 실패하면 **nginx 를 건드리지 않는다** — 옛 색이 계속 받고 있으므로 그게 곧 롤백이다.
        //
        // 전환하는 동안 두 인스턴스가 10초쯤 함께 산다. 스케줄러가 같은 건을 두 번 집을
        // 수 있지만 DB 락(FOR UPDATE·ON CONFLICT)과 멱등키가 막아서 낭비로 끝난다.
        // 자세한 근거는 이 파일 첫머리의 '무중단 배포' 절에 있다.
        stage('앱 배포 (운영 · 블루그린)') {
            when { environment name: 'DEPLOY_ENV', value: 'prod' }
            steps {
                script {
                    // 🔴 지금 색은 **nginx 가 실제로 보고 있는 파일**에서 읽는다.
                    //    컨테이너 목록으로 판단하면 실패한 배포가 남긴 유휴 컨테이너에 속는다.
                    def inc = "${DEPLOY_DIR}/nginx/conf.d/prod-backend.inc"
                    def cur = sh(returnStdout: true, script:
                        "sed -n 's|.*prod-server-\\([a-z][a-z]*\\):8080.*|\\1|p' '${inc}' | head -n1").trim()

                    if (cur != 'blue' && cur != 'green') {
                        echo "현재 색을 읽지 못했습니다 ('${cur}'). blue 로 보고 green 에 올립니다."
                        cur = 'blue'
                    }
                    env.OLD_COLOR = cur
                    env.NEW_COLOR = (cur == 'blue') ? 'green' : 'blue'
                    // '기동 확인' 과 post.failure 가 이 이름을 쓴다
                    env.SERVER_CONTAINER = "prod-server-${env.NEW_COLOR}"
                    echo "블루-그린 전환: ${env.OLD_COLOR} → ${env.NEW_COLOR} (${env.TAG})"
                }
                sh '''
                    set -e
                    export SENTRY_RELEASE="teacat-server@$TAG"

                    INC="$DEPLOY_DIR/nginx/conf.d/prod-backend.inc"
                    NEWC="prod-server-$NEW_COLOR"
                    OLDC="prod-server-$OLD_COLOR"

                    # ── 1. 인프라 ────────────────────────────────────────────────
                    # 🔴 여기서는 --remove-orphans 를 쓰지 않는다. 블루-그린 이전의 단일
                    #    컨테이너 prod-server 는 compose 파일에서 사라져 지금은 '고아' 다.
                    #    여기서 지우면 새 색이 뜨기도 전에 운영이 끊긴다 — 무중단이 목적인데
                    #    그 반대가 된다. 그 컨테이너는 전환이 끝난 6단계에서 지운다.
                    #
                    # 🔴 blockchain 은 **여기서 올리지 않는다**. 부팅할 때 Spring 스키마를
                    #    검사하고 컬럼이 없으면 스스로 죽는데(blockchain/api/src/main.ts),
                    #    그 컬럼은 server 가 Flyway 로 만든다. 여기서 --wait 로 묶으면
                    #    blockchain 은 server 를, 파이프라인은 blockchain 을 기다려
                    #    새 마이그레이션이 있는 배포가 통째로 막힌다. 4단계에서 올린다.
                    docker compose -f "$COMPOSE" --env-file "$ENV_FILE" up -d --wait \
                        postgres redis rabbitmq minio

                    # ── 2. 유휴 색을 새 이미지로 ─────────────────────────────────
                    # 🔴 --force-recreate 가 필요하다. 이미지 태그가 teacat-server:prod 로
                    #    고정이라 태그만으로는 compose 가 "바뀐 게 없다" 고 볼 수 있다.
                    # 🔴 --no-deps: 인프라는 위에서 --wait 로 확인했다. 빼면 depends_on 을
                    #    따라 blockchain 까지 같이 올라가 1단계에서 피한 순서 문제가
                    #    그대로 돌아온다.
                    docker compose -f "$COMPOSE" --env-file "$ENV_FILE" \
                        up -d --no-deps --force-recreate "server-$NEW_COLOR"

                    # ── 3. 새 색이 진짜 받을 준비가 됐는지 ───────────────────────
                    # 🔴 로그의 "Started TeacatApplication" 이 아니라 /actuator/health 를 본다.
                    #    로그는 컨텍스트가 떴다는 말일 뿐이고, health 는 DB·Redis 까지 UP 이어야
                    #    준다. 트래픽을 넘기는 판단이라 더 엄한 쪽을 쓴다.
                    #    (8081 은 관리 포트다. 호스트로 열지 않아 teacat-net 안에서만 닿는다)
                    OK=no
                    for i in $(seq 1 60); do
                        STATE=$(docker inspect -f '{{.State.Status}}' "$NEWC" 2>/dev/null || echo missing)
                        case "$STATE" in
                            missing)
                                echo "❌ $NEWC 컨테이너가 만들어지지 않았습니다."; exit 1 ;;
                            exited|dead)
                                echo "❌ $NEWC 가 기동 중 죽었습니다. 마지막 로그:"
                                docker logs --tail 80 "$NEWC" 2>&1 || true
                                echo "   운영은 $OLDC 가 그대로 받고 있습니다 — 전환하지 않았습니다."
                                exit 1 ;;
                        esac
                        if curl -sf -m 5 "http://$NEWC:8081/actuator/health" | grep -q '"status":"UP"'; then
                            OK=yes; echo "$NEWC 준비 완료 (${i}번째 확인)"; break
                        fi
                        sleep 5
                    done
                    if [ "$OK" != "yes" ]; then
                        echo "❌ $NEWC 가 5분 안에 UP 이 되지 않았습니다. 마지막 로그:"
                        docker logs --tail 80 "$NEWC" 2>&1 || true
                        echo "   운영은 $OLDC 가 그대로 받고 있습니다 — 전환하지 않았습니다."
                        exit 1
                    fi

                    # ── 4. blockchain ───────────────────────────────────────────
                    # 새 색이 UP 이라는 건 Flyway 가 끝났다는 뜻이다. 이제야 스키마 검사가
                    # 통과하므로 여기서 올린다.
                    #
                    # 🔴 --force-recreate. 1단계에서 안 올린 탓에 옛 이미지 컨테이너가
                    #    남아 있거나, 앞선 실패가 남긴 재시작 루프에 걸려 있을 수 있다.
                    #    그 상태로 --wait 만 걸면 compose 가 곧장 unhealthy 로 끊는다.
                    # 🔴 --no-deps: 인프라는 1단계에서 확인했다.
                    if ! docker compose -f "$COMPOSE" --env-file "$ENV_FILE" \
                            up -d --wait --no-deps --force-recreate blockchain; then
                        echo "❌ prod-blockchain 이 뜨지 않았습니다. 마지막 로그:"
                        docker logs --tail 80 prod-blockchain 2>&1 || true
                        echo "   운영은 $OLDC 가 그대로 받고 있습니다 — 전환하지 않았습니다."
                        exit 1
                    fi

                    # ── 5. 전환 ─────────────────────────────────────────────────
                    # 🔴 원본을 남기고 바꾼다. nginx -t 가 실패하면 되돌리고 reload 하지 않는다.
                    #    깨진 설정으로 reload 하면 nginx 는 옛 설정을 유지한 채 초록불만 켜진다.
                    # 🔴 sed 패턴에 $ 를 넣지 않는다 (`^set ` 로만 잡는다). 정규식의 $ 와
                    #    셸 인용이 엉켜 조용히 안 바뀌는 사고가 나기 쉽다.
                    cp "$INC" "$INC.bak"
                    sed -i "s|^set .*|set \\$api http://$NEWC:8080;|" "$INC"
                    grep -q "$NEWC:8080" "$INC" || {
                        mv "$INC.bak" "$INC"
                        echo "❌ 스위치 파일을 바꾸지 못했습니다. $INC 의 set 줄을 확인하세요."
                        exit 1; }

                    if ! docker exec nginx nginx -t; then
                        mv "$INC.bak" "$INC"
                        echo "❌ nginx 설정 검사 실패 — 전환하지 않았습니다. $OLDC 가 그대로 받습니다."
                        exit 1
                    fi
                    docker exec nginx nginx -s reload
                    rm -f "$INC.bak"
                    echo "트래픽을 $NEWC 로 넘겼습니다."

                    # ── 6. 옛 색 정리 ───────────────────────────────────────────
                    # 🔴 stop 만 한다. rm 하지 않는 이유는 되돌릴 때 `docker start` 한 줄이면
                    #    되기 때문이다 (docker/nginx/conf.d/prod-backend.inc 주석 참고).
                    docker stop "$OLDC" >/dev/null 2>&1 || true

                    # 블루-그린 이전의 단일 컨테이너. 이름이 prod-server 라 두 색이 단
                    # prod-server 별칭과 겹쳐 프로메테우스가 엉뚱한 쪽을 긁게 된다.
                    # 트래픽은 이미 새 색으로 넘어갔으므로 지금 지워도 끊기지 않는다.
                    if docker inspect prod-server >/dev/null 2>&1; then
                        echo "블루-그린 이전의 prod-server 컨테이너를 정리합니다."
                        docker rm -f prod-server >/dev/null 2>&1 || true
                    fi
                '''
            }
        }

        stage('nginx 적용') {
            steps {
                sh '''
                    set -e
                    # 🔴 -t 를 먼저. 설정이 깨진 채로 reload 하면 nginx 는 옛 설정을 유지하는데,
                    #    그러면 배포는 초록불인데 반영은 안 된 상태가 된다.
                    docker exec nginx nginx -t
                    docker exec nginx nginx -s reload
                '''
            }
        }

        stage('기동 확인') {
            steps {
                sh '''
                    set -e
                    # 개발은 dev-server, 운영은 방금 전환한 색(prod-server-blue|green).
                    # 배포 스테이지가 env.SERVER_CONTAINER 에 넣어 준다.
                    NAME="$SERVER_CONTAINER"
                    for i in $(seq 1 60); do
                        STATE=$(docker inspect -f '{{.State.Status}}' "$NAME" 2>/dev/null || echo missing)
                        [ "$STATE" = "missing" ] && { echo "$NAME 컨테이너가 없습니다"; exit 1; }
                        if docker logs "$NAME" 2>&1 | grep -q "Started TeacatApplication"; then
                            echo "$NAME 기동 완료"; break
                        fi
                        sleep 5
                    done
                    docker logs "$NAME" 2>&1 | grep -q "Started TeacatApplication" || {
                        echo "기동 확인 실패. 마지막 로그:"; docker logs --tail 80 "$NAME"; exit 1
                    }

                    # nginx 를 통해 실제로 닿는지
                    if [ "$DEPLOY_ENV" = "prod" ]; then HOST=teacat.site; else HOST=dev.teacat.site; fi
                    curl -sf -o /dev/null "https://$HOST/" && echo "$HOST 프론트 응답 정상"
                '''
            }
        }

        stage('모니터링 배포') {
            // 모니터링 스택은 호스트에 하나뿐이고 dev/prod 를 함께 감시한다 (monitoring/prometheus/prometheus.yml).
            // dev 배포든 prod 배포든 이 스테이지가 돈다 — 설정을 동기화하고, 스택을 올리고,
            // **자기 환경의** 타겟이 붙었는지 확인한다. 두 파이프라인이 동시에 돌 때
            // (disableConcurrentBuilds 는 브랜치별이라 못 막는다) compose 를 겹쳐 치지 않도록 flock 으로 직렬화한다.
            steps {
                // 모니터링이 깨져도 앱 배포는 성공으로 둔다 — 앱은 실제로 떴기 때문이다.
                // 대신 빌드를 노랑(UNSTABLE)으로 만들어 조용히 넘어가지 않게 한다.
                // 🔴 여기서 실패하면 "모니터링이 되고 있다고 믿는데 실은 아닌" 상태가 되므로,
                //    초록으로 덮지 않는 것이 중요하다.
                catchError(buildResult: 'UNSTABLE', stageResult: 'FAILURE') {
                    sh '''
                        set -e

                        MON_ENV="$DEPLOY_DIR/.env.monitoring"
                        MON_COMPOSE="$DEPLOY_DIR/docker-compose.monitoring.yml"
                        MON_HOOK="$DEPLOY_DIR/monitoring/alertmanager/webhook_url"

                        # 설정을 서버로 옮긴다. 저장소가 원본이라는 원칙은 여기도 같다.
                        # 🔴 cp 여야 한다. mv 로 갈아끼우면 파일 단위 바인드 마운트가 끊긴다
                        #    (prometheus.yml, loki-config.yml, config.alloy 가 파일 마운트다).
                        # 시크릿 검사보다 먼저 한다 — 첫 배포 때 여기서 .example 이 서버에 깔려야
                        # 아래 안내가 가리키는 파일이 실제로 있다.
                        mkdir -p "$DEPLOY_DIR/monitoring"
                        cp -rf docker/monitoring/. "$DEPLOY_DIR/monitoring/"
                        cp -f  docker/docker-compose.monitoring.yml "$MON_COMPOSE"
                        cp -f  docker/.env.monitoring.example "$DEPLOY_DIR/.env.monitoring.example"

                        # 시크릿은 저장소에 없다. 서버에 파일을 만들기 전까지는 건너뛴다.
                        if [ ! -f "$MON_ENV" ]; then
                            echo "⚠️  $MON_ENV 이 없어 모니터링 배포를 건너뜁니다. 서버에서:"
                            echo "      cp $DEPLOY_DIR/.env.monitoring.example $MON_ENV && chmod 600 $MON_ENV"
                            echo "    그 뒤 GRAFANA_ADMIN_PASSWORD 와 POSTGRES_PASSWORD_DEV(.env.dev 의 값)를 채우세요."
                            exit 0
                        fi
                        # 🔴 웹훅 파일이 없는 채로 up 하면 도커가 그 경로에 **디렉터리를** 만들고
                        #    alertmanager 가 "is a directory" 로 죽는다. 올리기 전에 막는다.
                        if [ -d "$MON_HOOK" ]; then
                            echo "❌ $MON_HOOK 이 디렉터리입니다 (도커가 만든 것). 지우고 파일로 만드세요."; exit 1
                        fi
                        if [ ! -f "$MON_HOOK" ]; then
                            echo "⚠️  $MON_HOOK 이 없어 모니터링 배포를 건너뜁니다. 서버에서:"
                            echo "      echo '<Mattermost 들어오는 웹후크 주소>' > $MON_HOOK && chmod 600 $MON_HOOK"
                            exit 0
                        fi

                        # 운영 DB 비밀번호가 채워져 있으면 prod 쪽 postgres-exporter 도 켠다 (compose profile).
                        # 비어 있으면 그 컨테이너는 만들지 않는다 — 운영이 없을 때 DOWN 타겟을 늘리지 않기 위해서다.
                        PROFILES=""
                        if grep -Eq '^POSTGRES_PASSWORD_PROD=.+' "$MON_ENV"; then PROFILES="--profile prod"; fi

                        # 🔴 문법 검사를 **적용 전에** 한다. 깨진 규칙 파일을 올리고 reload 하면 Prometheus 는
                        #    옛 설정을 유지한 채 에러만 남긴다 — 배포는 초록인데 새 알림은 안 걸린 상태가 된다.
                        #    "rule files found" 까지 확인한다 — 마운트 경로가 틀리면 규칙 파일을 못 보고도 SUCCESS 가 뜬다.
                        PROMTOOL_OUT=$(docker run --rm -v "$DEPLOY_DIR/monitoring/prometheus:/etc/prometheus:ro" \
                            --entrypoint promtool prom/prometheus:v3.1.0 \
                            check config /etc/prometheus/prometheus.yml) || { echo "$PROMTOOL_OUT"; exit 1; }
                        echo "$PROMTOOL_OUT"
                        echo "$PROMTOOL_OUT" | grep -q "rule files found" || {
                            echo "❌ 규칙 파일이 검사되지 않았습니다. 마운트 경로를 확인하세요."; exit 1; }

                        # 두 파이프라인이 동시에 여기 오면 compose 가 같은 프로젝트를 두 번 만진다. 직렬화한다.
                        flock -w 300 /tmp/teacat-monitoring.lock \
                            docker compose $PROFILES -f "$MON_COMPOSE" --env-file "$MON_ENV" up -d --remove-orphans

                        # 🔴 up -d 만으로는 설정이 반영되지 않는다. 컨테이너 정의가 그대로면 compose 는
                        #    아무것도 하지 않으므로, alerts.yml 만 고친 배포는 조용히 무시된다. 명시적으로 reload 한다.
                        #    (--web.enable-lifecycle 이 켜져 있어야 먹는다)
                        sleep 5
                        docker exec mon-prometheus   wget -qO- --post-data='' http://localhost:9090/-/reload >/dev/null \
                            && echo "prometheus 설정 reload"
                        docker exec mon-alertmanager wget -qO- --post-data='' http://localhost:9093/-/reload >/dev/null \
                            && echo "alertmanager 설정 reload"

                        # 지금 배포한 환경의 타겟이 실제로 붙었는지 확인한다. 스택이 떠 있는 것과 지표가 들어오는 것은 다르다.
                        # 🔴 "DOWN 이 없다" 만으로는 부족하다 — 라벨을 잘못 적어 타겟이 하나도 없으면 그것도 참이 된다.
                        #    UP 개수가 0 이 아닌 것도 함께 본다. 쿼리의 __E__ 는 probe() 가 배포 환경으로 바꾼다
                        #    (큰따옴표 안에 $DEPLOY_ENV 를 직접 넣으면 PromQL 의 " 와 셸 인용이 엉킨다).
                        probe() {
                            q=$(printf %s "$1" | sed "s/__E__/$DEPLOY_ENV/g")
                            docker exec mon-prometheus wget -qO- \
                                "http://localhost:9090/api/v1/query?query=$q" \
                                | grep -o '"value"' | wc -l
                        }
                        OK=no
                        for i in $(seq 1 12); do
                            UP=$(probe 'count(up{env="__E__"}==1)')
                            DOWN=$(probe 'up{env="__E__"}==0')
                            if [ "$UP" != "0" ] && [ "$DOWN" = "0" ]; then
                                OK=yes; echo "$DEPLOY_ENV 타겟 전부 정상"; break
                            fi
                            sleep 5
                        done
                        if [ "$OK" != "yes" ]; then
                            echo "❌ $DEPLOY_ENV 타겟이 붙지 않았습니다 (UP=$UP, DOWN=$DOWN)."
                            echo "   Prometheus 타겟 상태:"
                            docker exec mon-prometheus wget -qO- \
                                'http://localhost:9090/api/v1/targets?state=any' | head -c 2000
                            exit 1
                        fi
                    '''
                }
            }
        }
    }

    post {
        always {
            sh '''
                docker image prune -f >/dev/null 2>&1 || true

                # 프론트 이미지는 커밋마다 태그가 붙어 계속 쌓인다 (하나당 수십 MB).
                # prune 은 dangling 만 지우므로 여기서 최근 3개만 남기고 지운다.
                # docker images 는 최신순으로 출력한다. -latest 는 변경 감지가 쓰므로 제외.
                docker images teacat-client --format '{{.Tag}}' 2>/dev/null \
                    | grep "^$DEPLOY_ENV-" \
                    | grep -v -- '-latest$' \
                    | tail -n +4 \
                    | while read -r t; do
                          docker rmi "teacat-client:$t" >/dev/null 2>&1 || true
                      done || true
            '''
        }
        success {
            script {
                recordDeployment()
                notifyMM('#41BE89', "✅ ${env.DEPLOY_ENV} 배포 성공 — 빌드: ${env.BUILT_SUMMARY ?: '?'}", '배포자')
            }
        }
        failure {
            sh '''
                echo "── 실패 직전 상태 ──"
                docker compose -f "$COMPOSE" --env-file "$ENV_FILE" ps || true
                # 서버는 운영이면 색이 붙는다. 환경 결정 전에 죽었으면 비어 있을 수 있어 폴백을 둔다.
                for c in "${SERVER_CONTAINER:-$DEPLOY_ENV-server}" "$DEPLOY_ENV-blockchain"; do
                    echo "── $c ──"
                    docker logs --tail 50 "$c" 2>&1 || true
                done
            '''
            script { notifyMM('#D24B4E', "❌ ${env.DEPLOY_ENV ?: '?'} 배포 실패", '범인') }
        }
    }
}

// 어드민 통계 차트의 세로 마커선.
//
// "어떤 기능이 사람을 끌어들였나" 를 보려고 배포 시점을 기록한다.
//
// 🔴 운영(master)만 보낸다. dev 는 하루에도 여러 번 나가서 마커가 빽빽해지면 차트가 읽히지 않는다.
// 🔴 여기서 무슨 일이 나도 배포는 성공이다. 이미 컨테이너가 다 뜬 뒤이고, 통계 한 점 때문에
//    초록불을 빨간불로 바꿀 이유가 없다. 그래서 통째로 try 로 감싸고 curl 에도 || 를 붙인다.
// 🔴 배포 시각은 보내지 않는다. 서버가 받은 시각으로 찍는다 —
//    젠킨스(UTC)와 서버(Asia/Seoul)의 시간대가 달라 마커가 9시간 밀리는 걸 막는다.
//
// 같은 커밋을 다시 배포하면 서버가 무시한다(멱등). 재실행을 걱정하지 않아도 된다.
def recordDeployment() {
    if (env.DEPLOY_ENV != 'prod') {
        return
    }

    try {
        // 커밋 제목 한 줄. JSON 을 깨뜨리는 따옴표·역슬래시를 지우고 길이를 자른다
        // (서버 쪽 summary 는 varchar(200))
        def subject = sh(returnStdout: true,
            script: "git log -1 --pretty=%s | tr -d '\\\\\"' | cut -c1-190").trim()

        def payload = """{"environment":"${env.DEPLOY_ENV}","branch":"${env.DEPLOY_BRANCH}","commitHash":"${env.TAG}","summary":"${subject}","buildNumber":${env.BUILD_NUMBER}}"""

        withCredentials([string(credentialsId: 'teacat-analytics-key', variable: 'ANALYTICS_KEY')]) {
            sh """
                curl -sS -m 10 -X POST 'https://teacat.site/api/internal/deployments' \
                    -H 'Content-Type: application/json' \
                    -H "X-Internal-Api-Key: \$ANALYTICS_KEY" \
                    -d '${payload}' || echo '⚠️  배포 마커 기록 실패 (배포에는 영향 없음)'
            """
        }
    } catch (e) {
        // 자격증명(teacat-analytics-key)이 아직 없으면 여기로 온다
        echo "⚠️  배포 마커를 남기지 못했습니다: ${e.message}"
    }
}

/**
 * 이 배포를 만든 사람 — 실패 알림의 "범인".
 *
 * 출처가 여럿이라 순서대로 본다. 환경에 따라 하나만 채워지기 때문이다.
 *   1) GitLab 웹후크로 돌았으면 **푸시한 사람** (GitLab 플러그인이 넣어준다)
 *   2) 없으면 **마지막 커밋의 작성자** (git)
 *
 * MR 을 머지해서 돌았다면 2번이 "머지한 사람" 이 된다 — 배포를 일으킨 사람이므로
 * 그게 맞다. 코드를 쓴 사람이 궁금하면 커밋 해시로 따라가면 된다.
 *
 * 🔴 따옴표·역슬래시를 지운다. 이 값은 JSON 문자열 안에, 그 JSON 은 다시 셸의
 *    단일 인용 안에 들어가서, 하나만 새도 알림이 통째로 안 나간다.
 */
def culprit() {
    def name = env.gitlabUserName ?: env.GITLAB_USER_NAME

    if (!name) {
        try {
            name = sh(returnStdout: true, script: 'git log -1 --pretty=%an').trim()
        } catch (e) {
            // 체크아웃 전에 실패하면 저장소가 없다. 알림은 그래도 보내야 한다
            echo "범인을 알아내지 못했습니다: ${e.message}"
        }
    }

    /* 🔴 정규식을 쓰지 않는다. 슬래시 문자열(`/.../`)은 `\\` 를 백슬래시 하나로 줄여서
          `['"\]` 라는 깨진 문자 클래스가 되고, 런타임에 PatternSyntaxException 이 난다.
          그러면 **알림 자체가 안 나간다** — 실패를 알리는 코드가 실패하는 셈이다.
          문법 검사로는 안 잡히고 이름에 특수문자가 있을 때만 터지는 것도 아니라,
          매번 터진다. 그냥 하나씩 지운다. */
    return (name ?: '알 수 없음')
        .replace('"', '')
        .replace("'", '')
        .replace('\\', '')
        .take(40)
}

/**
 * @param whoLabel 이름 앞에 붙일 말. 실패는 "범인", 성공은 "배포자" —
 *                 성공 알림에 "범인" 이라고 쓰면 읽는 사람이 멈칫한다
 */
def notifyMM(String color, String title, String whoLabel) {
    def who = culprit()
    def commit = env.TAG ?: '?'

    withCredentials([string(credentialsId: 'mm-webhook', variable: 'HOOK')]) {
        // \\n 이어야 JSON 규격에 맞는다. \n 으로 쓰면 Groovy 가 진짜 줄바꿈을 넣어
        // JSON 문자열 안에 raw LF 가 들어간다.
        // (Mattermost 는 그것도 받아준다 — 빌드 #25 에서 ok 응답을 확인했다.
        //  고장난 적은 없고, 규격을 지키는 쪽으로만 맞춘 것이다)
        def text = "**${env.JOB_NAME}** #${env.BUILD_NUMBER}" +
            "\\n${whoLabel} — **${who}** (`${commit}`)" +
            "\\n[빌드 로그 보기](${env.BUILD_URL}console)"

        def payload = """{"attachments":[{"color":"${color}","title":"${title}","text":"${text}"}]}"""
        sh """curl -s -X POST -H 'Content-Type: application/json' -d '${payload}' "\$HOOK" """
    }
}
