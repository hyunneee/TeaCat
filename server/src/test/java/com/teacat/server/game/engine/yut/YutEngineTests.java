package com.teacat.server.game.engine.yut;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.game.engine.GameAction;
import com.teacat.server.game.engine.GameOptions;
import com.teacat.server.game.engine.GameStateCodec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class YutEngineTests {

    private static final GameOptions OPTIONS = new GameOptions(YutState.DEFAULT_PIECES);

    private GameStateCodec codec;
    private YutEngine engine;

    @BeforeEach
    void setUp() {
        codec = new GameStateCodec(new ObjectMapper());
        engine = new YutEngine(codec);
    }

    @Test
    void 시작하면_모두_판_밖에_있고_첫_자리가_던진다() {
        YutState state = codec.read(engine.start(4, OPTIONS), YutState.class);

        assertThat(state.players).isEqualTo(4);
        assertThat(state.turn).isZero();
        assertThat(state.canThrow).isTrue();
        assertThat(state.pieces).hasSize(4);
        assertThat(state.pieces).allSatisfy(mine -> assertThat(mine).containsExactly(-1, -1, -1, -1));
    }

    @Test
    void 말_수를_줄여서_시작하면_그_수만큼만_가진다() {
        YutState state = codec.read(engine.start(2, new GameOptions(2)), YutState.class);

        assertThat(state.piecesPerPlayer).isEqualTo(2);
        assertThat(state.pieces).allSatisfy(mine -> assertThat(mine).containsExactly(-1, -1));
        // 있지도 않은 3번 말을 움직이라고 하면 거절해야 한다
        Map<String, Object> thrown = engine.apply(codec.write(state), 0, new GameAction("THROW", null, null));
        assertThatThrownBy(() -> engine.apply(thrown, 0, new GameAction("MOVE", 2, 1)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void 던지면_방금_나온_결과가_남는다() {
        Map<String, Object> next = engine.apply(engine.start(2, OPTIONS), 0, new GameAction("THROW", null, null));
        YutState state = codec.read(next, YutState.class);

        // 화면 한가운데에 띄우려면 pending 이 아니라 이 값이 있어야 한다 — 쓴 결과는 pending 에서 빠진다
        assertThat(state.lastThrow).isNotNull().isBetween(1, 5);
        assertThat(state.lastThrowSeat).isZero();
        assertThat(state.throwSeq).isEqualTo(1);
    }

    @Test
    void 차례가_아니면_던지지_못한다() {
        Map<String, Object> state = engine.start(2, OPTIONS);

        assertThatThrownBy(() -> engine.apply(state, 1, new GameAction("THROW", null, null)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void 던지기_전에는_말을_못_움직인다() {
        Map<String, Object> state = engine.start(2, OPTIONS);

        assertThatThrownBy(() -> engine.apply(state, 0, new GameAction("MOVE", 0, 3)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void 던지면_결과가_쌓이고_윷_모가_아니면_움직여야_한다() {
        Map<String, Object> next = engine.apply(engine.start(2, OPTIONS), 0, new GameAction("THROW", null, null));

        YutState state = codec.read(next, YutState.class);
        assertThat(state.pending).hasSize(1);
        int result = state.pending.getFirst();
        assertThat(result).isBetween(1, 5);
        // 윷(4)·모(5)면 한 번 더 던진다
        assertThat(state.canThrow).isEqualTo(result >= 4);
    }

    @Test
    void 안_던진_값으로는_움직이지_못한다() {
        YutState state = codec.read(engine.start(2, OPTIONS), YutState.class);
        state.pending = new java.util.ArrayList<>(List.of(3));
        state.canThrow = false;
        Map<String, Object> raw = codec.write(state);

        assertThatThrownBy(() -> engine.apply(raw, 0, new GameAction("MOVE", 0, 5)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void 같은_밭의_내_말은_함께_움직인다() {
        YutState state = handMade(2);
        state.pieces.get(0).set(0, 3);
        state.pieces.get(0).set(1, 3);
        state.pending = new java.util.ArrayList<>(List.of(1));

        YutState after = codec.read(
                engine.apply(codec.write(state), 0, new GameAction("MOVE", 0, 1)), YutState.class);

        assertThat(after.pieces.get(0).get(0)).isEqualTo(4);
        assertThat(after.pieces.get(0).get(1)).isEqualTo(4);
        assertThat(after.pieces.get(0).get(2)).isEqualTo(-1);
    }

    @Test
    void 대기_중인_말은_하나씩만_나간다() {
        YutState state = handMade(2);
        state.pending = new java.util.ArrayList<>(List.of(1));

        YutState after = codec.read(
                engine.apply(codec.write(state), 0, new GameAction("MOVE", 0, 1)), YutState.class);

        assertThat(after.pieces.get(0)).containsExactly(0, -1, -1, -1);
    }

    @Test
    void 남의_말을_잡으면_처음으로_보내고_한_번_더_던진다() {
        YutState state = handMade(2);
        state.pieces.get(0).set(0, 2);
        state.pieces.get(1).set(0, 3);
        state.pending = new java.util.ArrayList<>(List.of(1));

        YutState after = codec.read(
                engine.apply(codec.write(state), 0, new GameAction("MOVE", 0, 1)), YutState.class);

        assertThat(after.pieces.get(1).get(0)).isEqualTo(YutBoard.HOME);
        assertThat(after.canThrow).isTrue();
        assertThat(after.turn).isZero();
    }

    @Test
    void 쓸_결과가_없고_더_못_던지면_차례가_넘어간다() {
        YutState state = handMade(2);
        state.pieces.get(0).set(0, 2);
        state.pending = new java.util.ArrayList<>(List.of(1));

        YutState after = codec.read(
                engine.apply(codec.write(state), 0, new GameAction("MOVE", 0, 1)), YutState.class);

        assertThat(after.turn).isEqualTo(1);
        assertThat(after.canThrow).isTrue();
    }

    @Test
    void 말_네_개를_다_빼면_완주하고_판이_끝난다() {
        YutState state = handMade(2);
        state.pieces.get(0).set(0, 18);
        state.pieces.get(0).set(1, YutBoard.GOAL);
        state.pieces.get(0).set(2, YutBoard.GOAL);
        state.pieces.get(0).set(3, YutBoard.GOAL);
        state.pending = new java.util.ArrayList<>(List.of(3));

        Map<String, Object> next = engine.apply(codec.write(state), 0, new GameAction("MOVE", 0, 3));

        YutState after = codec.read(next, YutState.class);
        assertThat(after.finishOrder).containsExactly(0);
        assertThat(after.finished).isTrue();
        assertThat(engine.ranking(next)).containsExactly(0, 1);
    }

    @Test
    void 끝내지_못한_사람은_남은_거리로_줄_선다() {
        YutState state = handMade(3);
        // 1번은 지름길로 중앙을 지나 도착이 가깝고, 2번은 바깥에서 한참 남았다
        state.pieces.get(1).set(0, 27);
        state.pieces.get(2).set(0, 1);
        state.finished = true;

        assertThat(engine.ranking(codec.write(state))).containsExactly(1, 2, 0);
    }

    @Test
    void 판을_떠난_사람은_꼴찌로_밀린다() {
        Map<String, Object> next = engine.retire(engine.start(3, OPTIONS), 0);

        assertThat(engine.ranking(next).getLast()).isZero();
    }

    @Test
    void 시간을_넘기면_서버가_그_차례를_끝까지_둔다() {
        Map<String, Object> state = engine.start(2, OPTIONS);

        YutState after = codec.read(engine.autoAdvance(state), YutState.class);

        /* 🔴 던지기만 대신 해 주고 나오지 않는다. 끊긴 사람을 대신하는 게 목적인데
           말을 안 옮기고 나오면 그 사람의 차례가 "옮기기" 단계로 넘어가 1분을 더 잡아먹는다.
           그래서 쓸 결과가 남지 않고 차례가 다음 사람에게 넘어가 있어야 한다. */
        assertThat(after.pending).isEmpty();
        assertThat(after.turn).isEqualTo(1);
    }

    /**
     * 던지는 단계와 옮기는 단계의 제한 시간이 다르다.
     *
     * <p>하나로 묶으면 둘 중 하나가 틀어진다 — 던지기에 60초를 주면 끊긴 사람 때문에 판이
     * 1분씩 서고, 옮기기를 10초로 조이면 판을 들여다보는 사람의 말을 서버가 가로챈다.
     */
    @Test
    void 던질_차례는_짧고_옮길_차례는_길다() {
        Map<String, Object> throwPhase = engine.start(2, OPTIONS);
        YutState movePhase = handMade(2);
        movePhase.pending.add(3);

        assertThat(engine.turnLimit(throwPhase)).isEqualTo(Duration.ofSeconds(10));
        assertThat(engine.turnLimit(codec.write(movePhase))).isEqualTo(Duration.ofSeconds(60));
    }

    /* ── 잡기와 추가 던지기 ─────────────────────────────────── */

    @Test
    void 도로_잡으면_한_번_더_던진다() {
        YutState state = handMade(2);
        state.pieces.get(0).set(0, 2);
        state.prev.get(0).set(0, 1);
        state.pieces.get(1).set(0, 3);
        state.pending.add(1);

        YutState after = applyMove(state, 0, 1);

        assertThat(after.pieces.get(1).get(0)).isEqualTo(-1);
        /* 추가 던지기 여부는 canThrow 가 아니라 <b>차례가 넘어갔는가</b>로 본다 —
           차례가 넘어가면 다음 사람을 위해 canThrow 가 어차피 true 로 돌아온다 */
        assertThat(after.turn).isZero();
        assertThat(after.canThrow).isTrue();
    }

    /**
     * 🔴 윷·모로 잡으면 한 번 더 던지지 않는다.
     *
     * <p>윷·모는 그 자체로 이미 한 번 더 던지게 해 줬다. 거기에 잡기까지 얹으면 한 번의
     * 운으로 두 번을 더 던지게 되어, 한 사람이 턴을 길게 끌고 나머지는 구경만 한다.
     */
    @Test
    void 윷이나_모로_잡으면_한_번_더_던지지_않는다() {
        for (int steps : new int[] {4, 5}) {
            YutState state = handMade(2);
            state.pieces.get(0).set(0, 2);
            state.prev.get(0).set(0, 1);
            state.pieces.get(1).set(0, 2 + steps);
            state.pending.add(steps);

            YutState after = applyMove(state, 0, steps);

            assertThat(after.pieces.get(1).get(0)).as("%d 로 잡혔어야 한다", steps).isEqualTo(-1);
            // 차례가 넘어갔다 = 잡은 사람에게 추가 던지기가 돌아오지 않았다
            assertThat(after.turn).as("%d 로 잡으면 차례가 넘어간다", steps).isEqualTo(1);
        }
    }

    /* ── 백도 ──────────────────────────────────────────────── */

    @Test
    void 백도는_지나온_칸으로_되돌아간다() {
        YutState state = handMade(2);
        state.pieces.get(0).set(0, 7);
        // 지름길로 7번에 닿았다고 치면, 되돌아갈 곳은 판 모양이 아니라 이 값이다
        state.prev.get(0).set(0, 22);
        state.pending.add(YutEngine.BACKDO);

        YutState after = applyMove(state, 0, YutEngine.BACKDO);

        assertThat(after.pieces.get(0).get(0)).isEqualTo(22);
        // 되돌아간 말의 "지나온 칸" 은 방금 떠난 자리다
        assertThat(after.prev.get(0).get(0)).isEqualTo(7);
    }

    @Test
    void 판에_나온_말이_없으면_백도는_쓸_수_없다() {
        YutState state = handMade(2);
        state.pending.add(YutEngine.BACKDO);

        assertThatThrownBy(() -> engine.apply(codec.write(state), 0,
                new GameAction("MOVE", 0, YutEngine.BACKDO)))
                .isInstanceOf(BusinessException.class);
    }

    /**
     * 🔴 쓸 수 없는 백도는 버려야 차례가 끝난다.
     *
     * <p>차례는 {@code pending} 이 비어야 넘어간다. 되돌릴 말이 없는 백도를 들고 있으면
     * 아무리 눌러도 쓸 수가 없어 판이 선다 — 할리갈리에서 똑같은 모양으로 멈췄던 적이 있다.
     */
    @Test
    void 쓸_말이_없는_백도는_버리고_차례가_넘어간다() {
        YutState state = handMade(2);
        state.canThrow = false;
        state.pending.add(YutEngine.BACKDO);
        // 막 나온 말 — 되돌아갈 곳이 없다
        state.pieces.get(0).set(0, 0);
        state.prev.get(0).set(0, -1);

        YutState after = codec.read(engine.autoAdvance(codec.write(state)), YutState.class);

        assertThat(after.pending).isEmpty();
        assertThat(after.turn).isEqualTo(1);
    }

    @Test
    void 잡힌_말은_지나온_길도_지운다() {
        YutState state = handMade(2);
        state.pieces.get(0).set(0, 2);
        state.prev.get(0).set(0, 1);
        state.pieces.get(1).set(0, 3);
        state.prev.get(1).set(0, 2);
        state.pending.add(1);

        YutState after = applyMove(state, 0, 1);

        // 안 지우면 다시 나온 뒤 백도로 잡히기 전 칸으로 순간이동한다
        assertThat(after.prev.get(1).get(0)).isEqualTo(-1);
    }

    private YutState applyMove(YutState state, int piece, int steps) {
        return codec.read(
                engine.apply(codec.write(state), state.turn, new GameAction("MOVE", piece, steps)),
                YutState.class);
    }

    /** 말을 마음대로 놓기 위해 던지기 전 상태로 되돌린 판 */
    private YutState handMade(int players) {
        YutState state = codec.read(engine.start(players, OPTIONS), YutState.class);
        state.canThrow = false;
        return state;
    }
}
