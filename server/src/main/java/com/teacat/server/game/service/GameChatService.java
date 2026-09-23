package com.teacat.server.game.service;

import com.teacat.server.game.dto.response.GameChatMessageResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 방 안에서 주고받는 채팅.
 *
 * <p>🔴 <b>DB 에 저장하지 않는다.</b> 채팅은 <b>지금 같이 있는 사람들끼리</b> 하는 말이고
 * 판이 끝나면 쓸 일이 없다 — 나중에 다시 꺼내 볼 화면도, 신고·검색 기능도 없다. 표 하나를
 * 늘리면 마이그레이션·엔티티·리포지터리가 따라오는데 얻는 것이 없다.
 *
 * <p>대신 <b>잃는 것</b>을 적어 둔다 — 서버를 다시 띄우면 그때까지의 대화가 사라진다.
 * 새로고침이나 재접속에는 살아남는다(대화를 들고 있는 쪽이 서버라서). 진행 중인 판은
 * {@code game_rooms.state} 에 그대로 있으므로 게임이 끊기지는 않는다.
 *
 * <p>🔴 {@link GameEventBroker} 와 같은 전제다 — <b>인스턴스가 하나</b>. 여러 대로 늘리면
 * 다른 인스턴스에 붙은 사람에게 말이 가지 않으므로 그때는 Redis 로 옮겨야 한다.
 */
@Slf4j
@Component
public class GameChatService {

    /** 방마다 남겨 두는 줄 수. 넘치면 오래된 것부터 버린다 */
    private static final int MAX_LINES = 100;

    /** 이만큼 조용한 방은 통째로 버린다. 끝나지 않고 버려진 방이 메모리에 쌓이지 않게 */
    private static final Duration IDLE_DROP = Duration.ofHours(2);

    private final Map<Long, Room> rooms = new ConcurrentHashMap<>();

    private static final class Room {
        private final Deque<GameChatMessageResponse> lines = new ArrayDeque<>();
        private long seq;
        private LocalDateTime touchedAt = LocalDateTime.now();
    }

    /** 한 줄 남긴다. 돌려주는 값이 방금 들어간 줄이다 */
    public GameChatMessageResponse post(Long roomId, int seatNo, String nickname, String message) {
        Room room = rooms.computeIfAbsent(roomId, id -> new Room());
        synchronized (room) {
            GameChatMessageResponse line = new GameChatMessageResponse(
                    ++room.seq, seatNo, nickname, message.strip(), LocalDateTime.now());
            room.lines.addLast(line);
            while (room.lines.size() > MAX_LINES) {
                room.lines.removeFirst();
            }
            room.touchedAt = LocalDateTime.now();
            return line;
        }
    }

    /** 지금까지의 대화. 오래된 것이 앞이다 */
    public List<GameChatMessageResponse> history(Long roomId) {
        Room room = rooms.get(roomId);
        if (room == null) {
            return List.of();
        }
        synchronized (room) {
            return List.copyOf(room.lines);
        }
    }

    /** 판이 끝나거나 방이 닫히면 버린다 */
    public void clear(Long roomId) {
        rooms.remove(roomId);
    }

    @Scheduled(fixedDelay = 10 * 60 * 1000L)
    public void dropIdleRooms() {
        LocalDateTime cutoff = LocalDateTime.now().minus(IDLE_DROP);
        rooms.entrySet().removeIf(entry -> entry.getValue().touchedAt.isBefore(cutoff));
    }
}
