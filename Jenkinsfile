// 티캣 배포 파이프라인
//
//   dev    브랜치 → 개발 서버 (dev.teacat.site)
//   master 브랜치 → 운영 서버 (teacat.site)
//
// 젠킨스는 호스트 도커 소켓을 빌려 쓴다. 여기서 도는 docker 명령은 호스트에서
// 도는 것과 같다. ~/teacat 이 컨테이너에 같은 경로로 마운트돼 있어야 한다.
//
// 시크릿은 저장소에 없다. ~/teacat/.env.<env> 를 그대로 읽는다.

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

                    echo "브랜치 ${branch} → ${resolved} 배포 (${env.TAG})"
                }
            }
        }

        stage('사전 점검') {
            steps {
                sh '''
                    set -e
                    test -r "$ENV_FILE" || { echo "$ENV_FILE 을 읽을 수 없습니다."; exit 1; }
                    test -r "$COMPOSE"  || { echo "$COMPOSE 가 없습니다."; exit 1; }
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

        stage('이미지 빌드') {
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

                    docker build -t teacat-client:$DEPLOY_ENV-$TAG \
                        --build-arg VITE_USE_MOCK=$MOCK ./client
                    docker build -t teacat-server:$DEPLOY_ENV     ./server
                    docker build -t teacat-blockchain:$DEPLOY_ENV ./blockchain
                '''
            }
        }

        stage('프론트 배포') {
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

        stage('앱 배포') {
            steps {
                sh '''
                    set -e
                    docker compose -f "$COMPOSE" --env-file "$ENV_FILE" up -d --remove-orphans
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
                    NAME="$DEPLOY_ENV-server"
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
    }

    post {
        always {
            sh 'docker image prune -f >/dev/null 2>&1 || true'
        }
        success { script { notifyMM('#41BE89', "✅ ${env.DEPLOY_ENV} 배포 성공") } }
        failure {
            sh '''
                echo "── 실패 직전 상태 ──"
                docker compose -f "$COMPOSE" --env-file "$ENV_FILE" ps || true
                for s in server blockchain; do
                    echo "── $DEPLOY_ENV-$s ──"
                    docker logs --tail 50 "$DEPLOY_ENV-$s" 2>&1 || true
                done
            '''
            script { notifyMM('#D24B4E', "❌ ${env.DEPLOY_ENV ?: '?'} 배포 실패") }
        }
    }
}

def notifyMM(String color, String title) {
    withCredentials([string(credentialsId: 'mm-webhook', variable: 'HOOK')]) {
        def payload = """{"attachments":[{"color":"${color}","title":"${title}","text":"**${env.JOB_NAME}** #${env.BUILD_NUMBER}\n[빌드 로그 보기](${env.BUILD_URL}console)"}]}"""
        sh """curl -s -X POST -H 'Content-Type: application/json' -d '${payload}' "\$HOOK" """
    }
}
