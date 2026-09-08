# syntax=docker/dockerfile:1.7
# 젠킨스 + 도커 CLI
#
# 호스트 /usr/bin/docker 를 마운트하는 대신 이미지에 제대로 설치한다.
# 마운트 방식은 docker 실행 파일 하나만 들어와서 `docker compose` 가 없다
# (compose 는 /usr/libexec/docker/cli-plugins/ 에 있는 별도 플러그인이다).
#
# 자기 안에서 도커를 돌리지 않고(DinD 아님) 호스트 소켓을 빌려 쓴다.
# 🔴 소켓을 쥔다는 건 호스트 도커를 전부 조종할 수 있다는 뜻이다. 사실상 서버 root 권한이라
#    젠킨스 관리자 계정을 아무에게나 주지 말 것.

FROM jenkins/jenkins:lts

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg \
       | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
       https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
       > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

# compose 에서 user: root 로 돌린다. jenkins_home 이 이미 root 소유라 유저를 바꾸면
# 권한을 전부 다시 잡아야 한다. 어차피 소켓을 쥔 순간 root 권한과 같다.
