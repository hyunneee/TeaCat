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

    /**
     * 백도 — 지나온 칸으로 한 칸 되돌아간다.
     *
     * <p>칸 수를 그대로 값으로 쓰는 규칙이라 <b>음수 하나</b>를 따로 둔다. 0 을 쓰면
     * "안 움직임" 과 구분되지 않고, {@link #NAMES} 의 빈 0번과도 겹친다.
     */
    static final int BACKDO = -1;

    /**
     * 백도 표시가 붙은 윷가락.
     *
     * <p>실제 윷처럼 <b>가락 하나에만</b> 표시가 있다. 도(가락 하나만 엎어짐)가 나왔을 때
     * 그 하나가 표시된 가락이면 백도다. 그래서 도와 백도를 합친 확률은 예전의 도와 같고
     * (4/16), 그중 1/4 만 백도로 갈린다 — 판의 균형이 바뀌지 않는다.
     */
    private static final int BACKDO_STICK = 0;

    /**
     * 던지기까지 주는 시간.
     *
     * <p>🔴 <b>말을 옮기는 시간보다 짧다.</b> 이 기능은 느리게 두는 사람을 재촉하려는 게
     * 아니라 <b>연결이 끊긴 사람 대신 판을 이어가려는</b> 것이다. 던지기는 버튼 하나라
     * 10초를 못 넘길 이유가 없고, 넘겼다면 사람이 보고 있지 않다는 뜻에 가깝다.
     */
    private static final Duration THROW_LIMIT = Duration.ofSeconds(10);

    /**
     * 말을 옮기기까지 주는 시간.
     *
     * <p>어느 말을 어느 결과로 옮길지는 판을 보고 고르는 일이라 넉넉히 준다. 던지기와
     * 같은 10초로 묶으면 고민하는 사람의 말을 서버가 대신 옮겨 버린다.
     */
    private static final Duration MOVE_LIMIT = Duration.ofSeconds(60);

    /** 대신 두기 한 번에 허용하는 수. 윷·모가 계속 나오면 끝없이 돌 수 있어서 끊는다 */
    private static final int MAX_AUTO_STEPS = 50;

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
        return MOVE_LIMIT;
    }

    /**
     * 지금이 던질 차례면 10초, 말을 옮길 차례면 60초.
     *
     * <p>한 턴이 <b>던지기 → 옮기기</b> 두 단계라서 하나의 시간으로 묶으면 둘 중 하나가
     * 틀어진다 — 던지기에 60초를 주면 끊긴 사람 때문에 판이 1분씩 서고, 옮기기를 10초로
     * 조이면 판을 들여다보는 사람의 말을 서버가 가로챈다.
     */
    @Override
    public Duration turnLimit(Map<String, Object> state) {
        return codec.read(state, YutState.class).canThrow ? THROW_LIMIT : MOVE_LIMIT;
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
        /* 시간을 넘긴 사람 대신 서버가 둔다. 판을 멈춰 두면 판돈이 영영 묶인다.
​
           🔴 <b>한 수만 두고 나오지 않는다 — 그 차례를 끝까지 둔다.</b> 던지기만 대신 해 주면
              말은 그대로 멈춰 있고, 끊긴 사람의 차례가 "옮기기" 단계로 넘어가 1분을 더
              잡아먹는다. 끊긴 사람을 대신하는 게 목적이므로 차례가 넘어갈 때까지 둔다.
              사람이 직접 던졌다면 여기까지 오지 않으므로(제한 시간 안에 눌렀다는 뜻),
              고민하는 사람의 말을 가로채지 않는다. */
        int seat = s.turn;
        for (int guard = 0; guard < MAX_AUTO_STEPS && !s.finished && s.turn == seat; guard++) {
            if (s.canThrow) {
                throwYut(s);
            } else if (!s.pending.isEmpty()) {
                autoMove(s);
            } else {
                break;
            }
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
        s.addLog(s.turn + "번 자리 " + nameOf(result));

        /* 쓸 수 없는 결과는 들고 있어 봐야 차례가 안 끝난다. 백도가 대표적인 경우다 —
           판에 나온 말이 없거나 전부 막 나온 말이면 되돌아갈 곳이 없다 */
        dropUnusable(s);

        if (!s.canThrow && s.pending.isEmpty()) {
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

        s.ensurePrev();
        List<Integer> mine = s.pieces.get(s.turn);
        List<Integer> minePrev = s.prev.get(s.turn);
        int from = mine.get(pieceIndex);
        if (from == YutBoard.GOAL) {
            throw new BusinessException(GameErrorCode.INVALID_ACTION);
        }
        if (!canMove(s, pieceIndex, steps)) {
            throw new BusinessException(GameErrorCode.INVALID_ACTION);
        }

        // 백도는 계산하지 않고 **기억해 둔 칸**으로 되돌린다 (YutState.prev 주석)
        int to = steps == BACKDO ? minePrev.get(pieceIndex) : YutBoard.advance(from, steps);

        // 업기 — 같은 칸의 내 말은 전부 함께 옮긴다
        int moved = 0;
        for (int i = 0; i < s.piecesPerPlayer; i++) {
            if (mine.get(i) == from && (from != YutBoard.HOME || i == pieceIndex)) {
                mine.set(i, to);
                // 함께 간 말도 되돌아갈 곳은 "방금 떠난 칸" 이다
                minePrev.set(i, from);
                moved++;
            }
        }

        s.pending.remove(Integer.valueOf(steps));

        boolean captured = capture(s, to);
        if (captured && steps < 4) {
            /* 잡으면 한 번 더 던진다 — 단, <b>윷·모로 잡았으면 주지 않는다.</b>
               윷·모는 그 자체로 이미 한 번 더 던지게 해 줬기 때문에, 거기에 잡기까지
               얹으면 한 번의 운으로 두 번을 더 던진다. 실제로 그렇게 굴려 보면 한 사람이
               턴을 길게 끌고 나머지는 구경만 하게 된다. */
            s.canThrow = true;
        }

        s.addLog(s.turn + "번 자리 말 " + (pieceIndex + 1) + "번 " + nameOf(steps)
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
        // 옮기고 나면 쓸 수 있는 결과가 달라진다 — 남은 백도가 쓸모없어졌을 수 있다
        dropUnusable(s);
        if (!s.canThrow && s.pending.isEmpty()) {
            passTurn(s);
        }
    }

    /** 이 결과로 이 말을 움직일 수 있나 */
    private boolean canMove(YutState s, int pieceIndex, int steps) {
        s.ensurePrev();
        int at = s.pieces.get(s.turn).get(pieceIndex);
        if (at == YutBoard.GOAL) {
            return false;
        }
        if (steps != BACKDO) {
            return true;
        }
        /* 🔴 백도는 <b>판에 나와 있고 지나온 칸이 있는</b> 말만 쓸 수 있다.
           대기 중인 말은 뒤로 갈 자리가 없고, 막 나온 말을 되돌리면 판 밖으로 나가
           "출발도 안 한 상태" 가 된다 — 그건 되돌리기가 아니라 무르기다. */
        return YutBoard.isOnBoard(at) && YutBoard.isOnBoard(s.prev.get(s.turn).get(pieceIndex));
    }

    /** 이 결과로 움직일 수 있는 말이 하나라도 있나 */
    private boolean canUseAny(YutState s, int steps) {
        for (int i = 0; i < s.piecesPerPlayer; i++) {
            if (canMove(s, i, steps)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 쓸 말이 없는 결과를 버린다.
     *
     * <p>🔴 안 버리면 <b>차례가 끝나지 않는다.</b> 차례는 {@code pending} 이 비어야 넘어가는데,
     * 백도만 남고 되돌릴 말이 없으면 아무리 눌러도 쓸 수가 없어 판이 선다 —
     * 할리갈리에서 똑같은 모양으로 멈췄던 적이 있다.
     */
    private void dropUnusable(YutState s) {
        s.pending.removeIf(result -> !canUseAny(s, result));
    }

    /** 던지기 이름. 백도는 음수라 배열로 찾을 수 없다 */
    static String nameOf(int result) {
        return result == BACKDO ? "백도" : NAMES[result];
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
            List<Integer> theirPrev = s.prev.get(seat);
            for (int i = 0; i < s.piecesPerPlayer; i++) {
                if (theirs.get(i) == landing) {
                    theirs.set(i, YutBoard.HOME);
                    // 처음으로 돌아간 말은 지나온 길도 지운다 — 안 지우면 다시 나온 뒤
                    // 백도로 잡히기 전의 칸으로 순간이동한다
                    theirPrev.set(i, YutBoard.HOME);
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
            if (!canMove(s, i, steps)) {
                continue;
            }
            // 백도는 되돌아갈 곳이 정해져 있다. 앞으로 가는 수와 같은 잣대(멀리 가는 쪽)로 고른다
            int to = steps == BACKDO ? s.prev.get(s.turn).get(i) : YutBoard.advance(mine.get(i), steps);
            if (to > bestTo) {
                bestTo = to;
                best = i;
            }
        }
        if (best < 0) {
            // 이 결과로 쓸 말이 없다. 버리고 남은 것으로 이어 간다 (dropUnusable 과 같은 판단)
            s.pending.remove(Integer.valueOf(steps));
            if (!s.canThrow && s.pending.isEmpty()) {
                passTurn(s);
            }
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
        boolean[] flat = new boolean[4];
        int flats = 0;
        for (int i = 0; i < 4; i++) {
            flat[i] = random.nextBoolean();
            if (flat[i]) {
                flats++;
            }
        }
        if (flats == 0) {
            return 5;
        }
        if (flats == 4) {
            return 4;
        }
        /* 도인데 엎어진 하나가 표시된 가락이면 백도. 실제 윷과 같은 방식이라
           도+백도를 합친 확률은 예전의 도 그대로고(4/16) 그중 1/4 만 백도다 */
        if (flats == 1 && flat[BACKDO_STICK]) {
            return BACKDO;
        }
        return flats;
    }
}
