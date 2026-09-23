package com.teacat.server.game.engine.yut;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.game.engine.GameAction;
import com.teacat.server.game.engine.GameEngine;
import com.teacat.server.game.engine.GameOptions;
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
 * 윷놀이.
 *
 * <p>한 턴은 <b>던지기 → 말 고르기</b> 의 반복이다. 윷(4)·모(5)가 나오면 한 번 더 던지고,
 * 말을 잡아도 한 번 더 던진다. 던져 둔 결과가 여러 개 쌓일 수 있어서
 * ({@link YutState#pending}) 어느 결과로 어느 말을 움직일지는 사람이 고른다.
 *
 * <p>구현한 규칙 — 업기(같은 칸의 내 말은 함께 움직인다), 잡기(남의 말을 처음으로
 * 돌려보내고 한 번 더 던진다), 지름길({@link YutBoard}), 말을 다 빼면 완주.
 *
 * <p>⚠️ 백도(뒤로 한 칸)는 넣지 않았다. 갈림길에서 "뒤" 가 하나로 정해지지 않아
 * (중앙에서 뒤로 가면 어느 지름길로 돌아가야 하는가) 규칙을 먼저 정해야 한다.
 *
 * <p>난수는 {@link SecureRandom} 이다. 취소표 추첨과 달리 온체인 VRF 를 쓰지 않는 이유는
 * 한 판에 던지기가 수십 번 일어나는데 커밋·리빌이 한 번에 십수 초 걸리기 때문이다.
 */
@Component
@RequiredArgsConstructor
public class YutEngine implements GameEngine {

    /** 던지기 이름. 인덱스가 곧 칸 수라서 0번은 비워 둔다 */
    private static final String[] NAMES = {"", "도", "개", "걸", "윷", "모"};

    private static final Duration TURN_LIMIT = Duration.ofSeconds(60);

    private final GameStateCodec codec;
    private final SecureRandom random = new SecureRandom();

    @Override
    public GameType type() {
        return GameType.YUT;
    }

    @Override
    public Map<String, Object> start(int players, GameOptions options) {
        return codec.write(YutState.start(players, options.piecesPerPlayer()));
    }

    @Override
    public Duration turnLimit() {
        return TURN_LIMIT;
    }

    @Override
    public boolean isFinished(Map<String, Object> state) {
        return codec.read(state, YutState.class).finished;
    }

    @Override
    public Map<String, Object> apply(Map<String, Object> state, int seat, GameAction action) {
        YutState s = codec.read(state, YutState.class);
        if (s.finished) {
            throw new BusinessException(GameErrorCode.ROOM_NOT_PLAYING);
        }
        if (s.turn != seat) {
            throw new BusinessException(GameErrorCode.NOT_YOUR_TURN);
        }

        if (action.is("THROW")) {
            throwYut(s);
        } else if (action.is("MOVE")) {
            move(s, action);
        } else {
            throw new BusinessException(GameErrorCode.INVALID_ACTION);
        }
        return codec.write(s);
    }

    @Override
    public Map<String, Object> autoAdvance(Map<String, Object> state) {
        YutState s = codec.read(state, YutState.class);
        if (s.finished) {
            return codec.write(s);
        }
        // 시간을 넘긴 사람 대신 서버가 둔다. 판을 멈춰 두면 판돈이 영영 묶인다
        if (s.canThrow) {
            throwYut(s);
        } else if (!s.pending.isEmpty()) {
            autoMove(s);
        }
        return codec.write(s);
    }

    @Override
    public Map<String, Object> retire(Map<String, Object> state, int seat) {
        YutState s = codec.read(state, YutState.class);
        if (seat < s.retired.size()) {
            s.retired.set(seat, true);
        }
        s.addLog(seat + "번 자리가 나갔습니다");
        if (s.turn == seat) {
            passTurn(s);
        }
        checkGameOver(s);
        return codec.write(s);
    }

    @Override
    public List<Integer> ranking(Map<String, Object> state) {
        YutState s = codec.read(state, YutState.class);
        List<Integer> order = new ArrayList<>(s.finishOrder);

        // 완주하지 못한 사람은 남은 말이 얼마나 갔는지로 줄 세운다. 판을 떠난 사람은 언제나 뒤
        List<Integer> rest = new ArrayList<>();
        for (int seat = 0; seat < s.players; seat++) {
            if (!order.contains(seat)) {
                rest.add(seat);
            }
        }
        rest.sort(Comparator
                .comparing((Integer seat) -> s.isRetired(seat))
                .thenComparing(seat -> -progress(s, seat)));
        order.addAll(rest);
        return order;
    }

    /* ── 규칙 ─────────────────────────────────────────────── */

    private void throwYut(YutState s) {
        if (!s.canThrow) {
            throw new BusinessException(GameErrorCode.INVALID_ACTION);
        }
        int result = roll();
        s.pending.add(result);
        // 방금 뭐가 나왔는지 남긴다. 쓴 결과는 pending 에서 빠지므로 그것만으로는
        // 화면 한가운데에 "모!" 를 띄울 수가 없다 (YutState.lastThrow 주석)
        s.lastThrow = result;
        s.lastThrowSeat = s.turn;
        s.throwSeq++;
        // 윷·모는 한 번 더. 그 외에는 이제 말을 움직여야 한다
        s.canThrow = result >= 4;
        s.addLog(s.turn + "번 자리 " + NAMES[result]);

        if (!s.canThrow && !hasAnyMove(s)) {
            // 뺄 말이 하나도 없다 (모두 완주). 실제로는 완주하면 차례가 안 오므로 방어용이다
            s.pending.clear();
            passTurn(s);
        }
    }

    /**
     * 던져 놓은 결과 하나로 말 하나를 움직인다.
     *
     * <p>같은 칸에 있는 내 말은 함께 간다(업기). 도착한 칸에 남의 말이 있으면 처음으로
     * 돌려보내고 한 번 더 던진다(잡기).
     */
    private void move(YutState s, GameAction action) {
        if (s.pending.isEmpty() || action.piece() == null || action.value() == null) {
            throw new BusinessException(GameErrorCode.INVALID_ACTION);
        }
        int pieceIndex = action.piece();
        int steps = action.value();
        if (pieceIndex < 0 || pieceIndex >= s.piecesPerPlayer || !s.pending.contains(steps)) {
            throw new BusinessException(GameErrorCode.INVALID_ACTION);
        }

        List<Integer> mine = s.pieces.get(s.turn);
        int from = mine.get(pieceIndex);
        if (from == YutBoard.GOAL) {
            throw new BusinessException(GameErrorCode.INVALID_ACTION);
        }

        int to = YutBoard.advance(from, steps);

        // 업기 — 같은 칸의 내 말은 전부 함께 옮긴다
        int moved = 0;
        for (int i = 0; i < s.piecesPerPlayer; i++) {
            if (mine.get(i) == from && (from != YutBoard.HOME || i == pieceIndex)) {
                mine.set(i, to);
                moved++;
            }
        }

        s.pending.remove(Integer.valueOf(steps));

        boolean captured = capture(s, to);
        if (captured) {
            // 잡으면 한 번 더 던진다
            s.canThrow = true;
        }

        s.addLog(s.turn + "번 자리 말 " + (pieceIndex + 1) + "번 " + NAMES[steps]
                + (moved > 1 ? " (" + moved + "개 업고)" : "")
                + (to == YutBoard.GOAL ? " 완주" : "")
                + (captured ? " · 잡았습니다" : ""));

        if (allHome(mine)) {
            s.finishOrder.add(s.turn);
            s.addLog(s.turn + "번 자리 전부 완주");
        }

        if (checkGameOver(s)) {
            return;
        }
        if (!s.canThrow && s.pending.isEmpty()) {
            passTurn(s);
        }
    }

    /** 도착 칸에 있는 남의 말을 처음으로 돌려보낸다 */
    private boolean capture(YutState s, int landing) {
        if (!YutBoard.isOnBoard(landing)) {
            return false;
        }
        boolean captured = false;
        for (int seat = 0; seat < s.players; seat++) {
            if (seat == s.turn) {
                continue;
            }
            List<Integer> theirs = s.pieces.get(seat);
            for (int i = 0; i < s.piecesPerPlayer; i++) {
                if (theirs.get(i) == landing) {
                    theirs.set(i, YutBoard.HOME);
                    captured = true;
                }
            }
        }
        return captured;
    }

    /** 시간을 넘겼을 때 서버가 대신 두는 수 — 가장 멀리 갈 수 있는 말을 고른다 */
    private void autoMove(YutState s) {
        int steps = s.pending.getFirst();
        List<Integer> mine = s.pieces.get(s.turn);

        int best = -1;
        int bestTo = -2;
        for (int i = 0; i < s.piecesPerPlayer; i++) {
            if (mine.get(i) == YutBoard.GOAL) {
                continue;
            }
            int to = YutBoard.advance(mine.get(i), steps);
            if (to > bestTo) {
                bestTo = to;
                best = i;
            }
        }
        if (best < 0) {
            s.pending.clear();
            passTurn(s);
            return;
        }
        move(s, new GameAction("MOVE", best, steps));
    }

    private boolean hasAnyMove(YutState s) {
        return s.pieces.get(s.turn).stream().anyMatch(p -> p != YutBoard.GOAL);
    }

    private boolean allHome(List<Integer> pieces) {
        return pieces.stream().allMatch(p -> p == YutBoard.GOAL);
    }

    private void passTurn(YutState s) {
        for (int i = 1; i <= s.players; i++) {
            int next = (s.turn + i) % s.players;
            if (s.isPlayable(next)) {
                s.turn = next;
                s.canThrow = true;
                s.pending.clear();
                return;
            }
        }
        // 둘 사람이 없다 — 판이 끝났다
        s.finished = true;
    }

    /**
     * 끝났나.
     *
     * <p>마지막 한 사람만 남으면 끝낸다. 혼자 남아서 말을 마저 빼는 시간은 등수에 영향이 없다.
     * 혼자 하는 연습 판은 그 한 사람이 완주해야 끝난다.
     */
    private boolean checkGameOver(YutState s) {
        long remaining = 0;
        for (int seat = 0; seat < s.players; seat++) {
            if (s.isPlayable(seat)) {
                remaining++;
            }
        }
        if (remaining <= (s.players == 1 ? 0 : 1)) {
            s.finished = true;
            return true;
        }
        if (!s.isPlayable(s.turn)) {
            passTurn(s);
        }
        return s.finished;
    }

    /**
     * 등수 비교용 진행도 — 말 네 개가 간 칸 수의 합.
     *
     * <p>밭 번호가 아니라 <b>남은 거리</b>로 잰다. 지름길 밭은 번호가 큰데도 도착까지
     * 멀 수 있어서, 번호로 줄 세우면 더 앞선 말이 뒤로 밀린다.
     */
    private int progress(YutState s, int seat) {
        int sum = 0;
        for (int position : s.pieces.get(seat)) {
            sum += YutBoard.maxSteps() - YutBoard.stepsToGoal(position);
        }
        return sum;
    }

    /**
     * 윷가락 네 개.
     *
     * <p>엎어진 개수로 정한다 — 0개 모(5), 1개 도(1), 2개 개(2), 3개 걸(3), 4개 윷(4).
     * 확률은 1/16, 4/16, 6/16, 4/16, 1/16 으로 실제 윷과 같다.
     */
    private int roll() {
        int flats = 0;
        for (int i = 0; i < 4; i++) {
            if (random.nextBoolean()) {
                flats++;
            }
        }
        return switch (flats) {
            case 0 -> 5;
            case 4 -> 4;
            default -> flats;
        };
    }
}
