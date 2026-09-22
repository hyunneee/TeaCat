package com.teacat.server.game.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 방 안의 사람들에게 판이 바뀌었다고 알린다 (Server-Sent Events).
 *
 * <p>SSE 를 고른 이유는 이 게임들이 <b>서버 → 클라이언트 한 방향</b>만 필요하기 때문이다.
 * 플레이어의 행동은 평범한 POST 로 오고, 서버는 바뀐 판을 밀어주기만 하면 된다.
 * 웹소켓을 붙이면 라이브러리와 nginx Upgrade 설정이 늘어나는데 얻는 것이 없다.
 * SseEmitter 는 spring-webmvc 에 이미 있고, nginx 의 {@code /api/} 에는
 * {@code proxy_buffering off} 가 이미 켜져 있다.
 *
 * <p>🔴 <b>연결은 서버 메모리에 있다.</b> 인스턴스가 하나라는 전제다(dev·prod 모두
 * {@code container_name} 하나). 여러 대로 늘리면 다른 인스턴스에 붙은 사람에게 이벤트가
 * 가지 않으므로, 그때는 Redis pub/sub 으로 한 번 퍼뜨려야 한다.
 *
 * <p>이벤트는 <b>알림일 뿐 데이터가 아니다.</b> 받은 쪽은 조회 API 를 다시 부른다. 그래야
 * 사람마다 다르게 가려야 하는 정보(할리갈리의 엎어 둔 카드)를 SSE 가 알 필요가 없다.
 */
@Slf4j
@Component
public class GameEventBroker {

    /** 끊긴 줄 모르고 쌓이지 않도록 넉넉하되 무한은 아니게. 프론트는 끊기면 다시 붙는다 */
    private static final long TIMEOUT_MS = 30 * 60 * 1000L;

    private final Map<Long, Map<Long, SseEmitter>> rooms = new ConcurrentHashMap<>();
    private final AtomicLong subscriptionSeq = new AtomicLong();

    /**
     * 방을 구독한다.
     *
     * <p>한 사람이 탭을 여러 개 열 수 있으므로 구독 키는 userId 가 아니라 구독마다 새로
     * 뽑는 번호다. userId 로 잡으면 새 탭이 이전 탭의 연결을 끊는다.
     */
    public SseEmitter subscribe(Long roomId) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        long key = subscriptionSeq.incrementAndGet();

        rooms.computeIfAbsent(roomId, id -> new ConcurrentHashMap<>()).put(key, emitter);

        emitter.onCompletion(() -> remove(roomId, key));
        emitter.onTimeout(() -> remove(roomId, key));
        emitter.onError(e -> remove(roomId, key));

        // 첫 이벤트를 바로 보낸다. 프록시가 응답 헤더를 흘려보내야 브라우저가 연결됐다고 본다
        send(emitter, "ready", "1");
        return emitter;
    }

    /** 이 방을 보고 있는 모두에게 "다시 읽어라" 고 알린다 */
    public void publish(Long roomId, String event) {
        Map<Long, SseEmitter> subscribers = rooms.get(roomId);
        if (subscribers == null) {
            return;
        }
        subscribers.forEach((key, emitter) -> {
            if (!send(emitter, event, String.valueOf(System.currentTimeMillis()))) {
                remove(roomId, key);
            }
        });
    }

    /**
     * 살아 있는지 알리는 빈 신호.
     *
     * <p>nginx 의 {@code proxy_read_timeout} 이 120초라 그동안 아무것도 안 보내면 연결이
     * 끊긴다. 대기실에서 한참 기다리는 것이 정상인 화면이라 이게 없으면 계속 재연결한다.
     */
    @Scheduled(fixedDelay = 15_000)
    public void heartbeat() {
        rooms.forEach((roomId, subscribers) -> subscribers.forEach((key, emitter) -> {
            if (!send(emitter, "ping", "1")) {
                remove(roomId, key);
            }
        }));
    }

    private boolean send(SseEmitter emitter, String event, String data) {
        try {
            emitter.send(SseEmitter.event().name(event).data(data));
            return true;
        } catch (IOException | IllegalStateException e) {
            // 브라우저가 탭을 닫으면 늘 나는 예외다. ERROR 로 올리면 Sentry 가 이걸로 뒤덮인다
            return false;
        }
    }

    private void remove(Long roomId, Long key) {
        Map<Long, SseEmitter> subscribers = rooms.get(roomId);
        if (subscribers == null) {
            return;
        }
        subscribers.remove(key);
        if (subscribers.isEmpty()) {
            rooms.remove(roomId);
        }
    }
}
