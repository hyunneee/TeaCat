package com.teacat.server.game.engine.halligalli;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.game.engine.GameAction;
import com.teacat.server.game.engine.GameEngine;
import com.teacat.server.game.engine.GameStateCodec;
import com.teacat.server.game.entity.GameType;
import com.teacat.server.game.exception.GameErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * 할리갈리.
 *
 * <p>카드를 뒤집는 것은 차례대로지만 <b>종은 아무나 아무 때나</b> 친다. 그래서
 * {@code FLIP} 만 차례를 따지고 {@code BELL} 은 따지지 않는다.
 *
 * <p>🔴 <b>누가 먼저 쳤는가는 이 클래스가 정하지 않는다.</b> 방 행을 잠근 채 부르기
 * 때문에 (GameRoomService) 같은 순간에 들어온 종 요청들은 DB 가 줄을 세우고, 두 번째
 * 요청이 들어올 때는 이미 첫 번째가 카드를 걷어간 뒤라 자연히 실패한다. 서버 시계로
 * 시각을 비교하지 않는다 — 비교할 시점에는 이미 순서가 정해져 있다.
 *
 * <p>규칙 — 보이는 카드(각 더미 맨 위) 중 같은 과일이 정확히 5개면 종을 칠 수 있다.
 * 맞으면 펼쳐진 카드를 전부 가져가고, 틀리면 남은 사람에게 한 장씩 물어준다.
 * 뒤집을 카드가 없으면 그 자리는 빠진다. 마지막까지 남은 사람이 1등이다.
 */
@Component
@RequiredArgsConstructor
public class HalliGalliEngine implements GameEngine {

    /** 뒤집기 제한 시간. 윷놀이보다 짧다 — 한 번에 카드 한 장이라 고민할 것이 없다 */
    private static final Duration TURN_LIMIT = Duration.ofSeconds(15);

    private final GameStateCodec codec;
    private final SecureRandom random = new SecureRandom();

    @Override
    public GameType type() {
        return GameType.HALLI_GALLI;
    }

    @Override
    public Map<String, Object> start(int players) {
        return codec.write(HalliGalliState.start(players, random));
    }

    @Override
    public Duration turnLimit() {
        return TURN_LIMIT;
    }

    @Override
    public boolean isFinished(Map<String, Object> state) {
        return codec.read(state, HalliGalliState.class).finished;
    }

    @Override
    public Map<String, Object> apply(Map<String, Object> state, int seat, GameAction action) {
        HalliGalliState s = codec.read(state, HalliGalliState.class);
        if (s.finished) {
            throw new BusinessException(GameErrorCode.ROOM_NOT_PLAYING);
        }
        if (!s.isAlive(seat)) {
            throw new BusinessException(GameErrorCode.INVALID_ACTION);
        }

        if (action.is("FLIP")) {
            if (s.turn != seat) {
                throw new BusinessException(GameErrorCode.NOT_YOUR_TURN);
            }
            flip(s, seat);
        } else if (action.is("BELL")) {
            /* 🔴 손패가 비었어도 펼쳐 둔 카드가 남아 있으면 칠 수 있다. 그 카드는 아직 판
               위에 있고, 맞게 치면 되찾아 온다 — 막으면 되살아날 길이 없어진다.
               손패도 펼친 카드도 없을 때만 거절한다 */
            if (!s.canRing(seat)) {
                throw new BusinessException(GameErrorCode.INVALID_ACTION);
            }
            bell(s, seat);
        } else {
            throw new BusinessException(GameErrorCode.INVALID_ACTION);
        }
        return codec.write(s);
    }

    @Override
    public Map<String, Object> autoAdvance(Map<String, Object> state) {
        HalliGalliState s = codec.read(state, HalliGalliState.class);
        if (!s.finished && s.isAlive(s.turn)) {
            // 안 뒤집고 버티면 판이 멈춘다. 시간이 지나면 서버가 대신 뒤집는다
            flip(s, s.turn);
        }
        return codec.write(s);
    }

    @Override
    public Map<String, Object> retire(Map<String, Object> state, int seat) {
        HalliGalliState s = codec.read(state, HalliGalliState.class);
        if (s.isAlive(seat)) {
            eliminate(s, seat, "나갔습니다");
        }
        if (s.turn == seat) {
            passTurn(s);
        }
        checkGameOver(s);
        return codec.write(s);
    }

    @Override
    public List<Integer> ranking(Map<String, Object> state) {
        HalliGalliState s = codec.read(state, HalliGalliState.class);
        List<Integer> order = new ArrayList<>();

        // 살아남은 사람이 앞. 여럿이면 카드가 많은 순
        List<Integer> alive = new ArrayList<>();
        for (int seat = 0; seat < s.players; seat++) {
            if (s.isAlive(seat)) {
                alive.add(seat);
            }
        }
        alive.sort(Comparator.comparingInt((Integer seat) -> s.totalCards(seat)).reversed());
        order.addAll(alive);

        // 빠진 사람은 늦게 빠진 순서대로 (오래 버틴 쪽이 위)
        List<Integer> out = new ArrayList<>(s.eliminationOrder);
        for (int i = out.size() - 1; i >= 0; i--) {
            order.add(out.get(i));
        }
        return order;
    }

    /* ── 규칙 ─────────────────────────────────────────────── */

    private void flip(HalliGalliState s, int seat) {
        List<HalliGalliCard> hand = s.hands.get(seat);
        if (hand.isEmpty()) {
            /* 🔴 손패가 비었다고 바로 빼지 않는다. 펼쳐 둔 카드가 남아 있으면 아직 판 위에
               있는 것이고, 종을 맞게 치면 되찾아 온다. 차례만 넘긴다.
               손패도 펼친 카드도 없을 때가 진짜 끝이다 */
            if (s.totalCards(seat) == 0) {
                eliminate(s, seat, "카드가 다 떨어졌습니다");
            } else {
                s.addLog(seat + "번 자리는 뒤집을 카드가 없어 넘어갑니다");
            }
            passTurn(s);
            checkGameOver(s);
            return;
        }
        HalliGalliCard card = hand.removeFirst();
        s.piles.get(seat).addFirst(card);
        s.lastBellSeat = null;
        s.lastBellCorrect = null;
        s.addLog(seat + "번 자리가 카드를 뒤집었습니다");

        passTurn(s);
        checkGameOver(s);
    }

    private void bell(HalliGalliState s, int seat) {
        boolean correct = s.bellIsCorrect();
        s.lastBellSeat = seat;
        s.lastBellCorrect = correct;

        if (correct) {
            collectAllPiles(s, seat);
            s.addLog(seat + "번 자리가 종을 쳤습니다 · 성공");
        } else {
            payPenalty(s, seat);
            s.addLog(seat + "번 자리가 종을 쳤습니다 · 실패");
        }
        checkGameOver(s);
    }

    /** 맞게 쳤다 — 펼쳐진 카드를 전부 가져와 자기 더미 아래에 넣는다 */
    private void collectAllPiles(HalliGalliState s, int seat) {
        List<HalliGalliCard> won = new ArrayList<>();
        for (List<HalliGalliCard> pile : s.piles) {
            won.addAll(pile);
            pile.clear();
        }
        s.hands.get(seat).addAll(won);
    }

    /**
     * 틀리게 쳤다 — 남아 있는 다른 사람에게 한 장씩 물어준다.
     *
     * <p>손에 든 카드가 없으면 펼쳐 둔 카드에서 낸다. 둘 다 없으면 그 자리에서 빠진다.
     */
    private void payPenalty(HalliGalliState s, int seat) {
        for (int other = 0; other < s.players; other++) {
            if (other == seat || !s.isAlive(other)) {
                continue;
            }
            HalliGalliCard given = takeOne(s, seat);
            if (given == null) {
                eliminate(s, seat, "물어줄 카드가 없습니다");
                passTurn(s);
                return;
            }
            s.hands.get(other).add(given);
        }
    }

    private HalliGalliCard takeOne(HalliGalliState s, int seat) {
        List<HalliGalliCard> hand = s.hands.get(seat);
        if (!hand.isEmpty()) {
            return hand.removeFirst();
        }
        List<HalliGalliCard> pile = s.piles.get(seat);
        return pile.isEmpty() ? null : pile.removeFirst();
    }

    private void eliminate(HalliGalliState s, int seat, String why) {
        s.eliminated.set(seat, true);
        s.eliminationOrder.add(seat);
        s.addLog(seat + "번 자리 탈락 — " + why);
    }

    private void passTurn(HalliGalliState s) {
        for (int i = 1; i <= s.players; i++) {
            int next = (s.turn + i) % s.players;
            if (s.isAlive(next)) {
                s.turn = next;
                return;
            }
        }
        s.finished = true;
    }

    /** 혼자 남으면 끝. 연습 판(1인)은 카드를 다 뒤집어 빠질 때까지 돈다 */
    private void checkGameOver(HalliGalliState s) {
        long alive = 0;
        boolean anyoneCanFlip = false;
        for (int seat = 0; seat < s.players; seat++) {
            if (s.isAlive(seat)) {
                alive++;
                anyoneCanFlip |= s.canFlip(seat);
            }
        }
        if (alive <= (s.players == 1 ? 0 : 1)) {
            s.finished = true;
            return;
        }

        /* 🔴 아무도 뒤집을 카드가 없으면 끝낸다. 손패가 비어도 남겨 두는 규칙이 생기면서
           "모두 손패는 비었고 카드는 전부 펼쳐져 있는" 상태가 가능해졌는데, 그때는 종
           말고는 판이 움직이지 않아서 아무도 안 치면 영원히 멈춘다(스위퍼가 대신 뒤집으려
           해도 뒤집을 것이 없다). 아주 드물지만 멈춘 판은 판돈을 묶어 둔다.
           그 순간 칠 수 있는 종이 있었을 수도 있는데, 등수는 남은 카드 수로 가리므로
           한쪽으로 기울지 않는다. */
        if (!anyoneCanFlip) {
            s.addLog("아무도 뒤집을 카드가 없어 판을 마칩니다");
            s.finished = true;
        }
    }
}
