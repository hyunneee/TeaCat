package com.teacat.server.game.engine.yut;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.game.engine.GameAction;
import com.teacat.server.game.engine.GameOptions;
import com.teacat.server.game.engine.GameStateCodec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

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
    void 시간을_넘기면_서버가_대신_둔다() {
        Map<String, Object> state = engine.start(2, OPTIONS);

        YutState after = codec.read(engine.autoAdvance(state), YutState.class);

        // 아직 아무도 안 던졌으니 서버가 대신 던진다
        assertThat(after.pending).isNotEmpty();
    }

    /** 말을 마음대로 놓기 위해 던지기 전 상태로 되돌린 판 */
    private YutState handMade(int players) {
        YutState state = codec.read(engine.start(players, OPTIONS), YutState.class);
        state.canThrow = false;
        return state;
    }
}
