# 블루-그린 전환 스위치 — **지금 운영 트래픽을 받는 서버 컨테이너.**
#
# prod.conf 의 location /api/ 안에서 include 된다. 젠킨스가 새 색을 띄우고
# /actuator/health 를 확인한 뒤 이 한 줄을 바꿔 `nginx -s reload` 한다.
#
# 🔴 손으로 고치지 마라. 여기만 바꾸면 컨테이너는 그대로라 502 가 난다.
#    되돌릴 일이 있으면 두 가지를 함께 해야 한다:
#      docker start prod-server-green          (되돌릴 색을 먼저 띄우고)
#      이 줄을 green 으로 바꾼 뒤 docker exec nginx nginx -t && nginx -s reload
#
# 🔴 저장소의 이 파일은 **첫 배포용 기본값**일 뿐이다. 서버에 이미 있으면
#    젠킨스가 덮지 않는다 ('설정 동기화'). 덮으면 실제 떠 있는 색과 어긋난다.
#
# 🔴 .conf 로 이름을 바꾸지 마라. nginx.conf 가 conf.d/*.conf 를 server 블록으로
#    읽어서, 이 조각이 http 컨텍스트에 그대로 얹혀 기동이 깨진다.
set $api http://prod-server-blue:8080;
