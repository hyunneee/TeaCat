package com.teacat.server.game.engine.halligalli;

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

class HalliGalliEngineTests {

    /** 할리갈리는 말 수를 쓰지 않는다. 인터페이스가 요구해서 넣는 값이다 */
    private static final GameOptions OPTIONS = new GameOptions(4);

    private GameStateCodec codec;
    private HalliGalliEngine engine;

    @BeforeEach
    void setUp() {
        codec = new GameStateCodec(new ObjectMapper());
        engine = new HalliGalliEngine(codec);
    }

    @Test
    void 카드는_쉰여섯_장이고_고르게_나뉜다() {
        assertThat(HalliGalliState.newDeck()).hasSize(56);

        HalliGalliState state = codec.read(engine.start(4, OPTIONS), HalliGalliState.class);

        assertThat(state.hands).hasSize(4);
        assertThat(state.hands.stream().mapToInt(List::size).sum()).isEqualTo(56);
        assertThat(state.hands).allSatisfy(hand -> assertThat(hand).hasSize(14));
    }

    @Test
    void 과일마다_열네_장씩이다() {
        for (String fruit : HalliGalliState.FRUITS) {
            long count = HalliGalliState.newDeck().stream()
                    .filter(card -> card.fruit().equals(fruit))
                    .count();
            assertThat(count).as(fruit).isEqualTo(14);
        }
    }

    @Test
    void 내_차례가_아니면_뒤집지_못한다() {
        Map<String, Object> state = engine.start(2, OPTIONS);

        assertThatThrownBy(() -> engine.apply(state, 1, new GameAction("FLIP", null, null)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void 종은_차례가_아니어도_칠_수_있다() {
        Map<String, Object> state = engine.start(2, OPTIONS);

        // 규칙에 어긋나지 않는다 — 틀렸으면 벌칙을 받을 뿐 예외가 아니다
        Map<String, Object> next = engine.apply(state, 1, new GameAction("BELL", null, null));

        HalliGalliState after = codec.read(next, HalliGalliState.class);
        assertThat(after.lastBellSeat).isEqualTo(1);
    }

    @Test
    void 보이는_과일이_정확히_다섯이면_종이_맞다() {
        HalliGalliState state = handMade();
        state.piles.get(0).addFirst(new HalliGalliCard("BANANA", 3));
        state.piles.get(1).addFirst(new HalliGalliCard("BANANA", 2));

        assertThat(state.bellIsCorrect()).isTrue();
    }

    @Test
    void 다섯이_아니면_종이_틀리다() {
        HalliGalliState state = handMade();
        state.piles.get(0).addFirst(new HalliGalliCard("BANANA", 3));
        state.piles.get(1).addFirst(new HalliGalliCard("BANANA", 3));

        assertThat(state.bellIsCorrect()).isFalse();
    }

    @Test
    void 맨_위_카드만_센다() {
        HalliGalliState state = handMade();
        // 아래에 깔린 카드는 보이지 않으므로 합계에 들어가면 안 된다
        state.piles.get(0).addFirst(new HalliGalliCard("LIME", 4));
        state.piles.get(0).addFirst(new HalliGalliCard("LIME", 1));
        state.piles.get(1).addFirst(new HalliGalliCard("LIME", 4));

        assertThat(state.bellIsCorrect()).isTrue();
    }

    @Test
    void 종을_맞게_치면_펼쳐진_카드를_모두_가져간다() {
        HalliGalliState state = handMade();
        state.piles.get(0).addFirst(new HalliGalliCard("GRAPE", 2));
        state.piles.get(1).addFirst(new HalliGalliCard("GRAPE", 3));
        int before = state.hands.get(1).size();

        Map<String, Object> next = engine.apply(codec.write(state), 1, new GameAction("BELL", null, null));

        HalliGalliState after = codec.read(next, HalliGalliState.class);
        assertThat(after.lastBellCorrect).isTrue();
        assertThat(after.piles).allSatisfy(pile -> assertThat(pile).isEmpty());
        assertThat(after.hands.get(1)).hasSize(before + 2);
    }

    @Test
    void 종을_틀리게_치면_남은_사람에게_한_장씩_물어준다() {
        HalliGalliState state = handMade();
        state.piles.get(0).addFirst(new HalliGalliCard("GRAPE", 1));
        int mine = state.hands.get(1).size();
        int theirs = state.hands.get(0).size();

        Map<String, Object> next = engine.apply(codec.write(state), 1, new GameAction("BELL", null, null));

        HalliGalliState after = codec.read(next, HalliGalliState.class);
        assertThat(after.lastBellCorrect).isFalse();
        assertThat(after.hands.get(1)).hasSize(mine - 1);
        assertThat(after.hands.get(0)).hasSize(theirs + 1);
    }

    @Test
    void 손패도_펼친_카드도_없어야_탈락이다() {
        HalliGalliState state = handMade();
        state.hands.get(0).clear();   // 펼친 카드도 handMade 가 비워 둔다

        Map<String, Object> next = engine.apply(codec.write(state), 0, new GameAction("FLIP", null, null));

        HalliGalliState after = codec.read(next, HalliGalliState.class);
        assertThat(after.isAlive(0)).isFalse();
        assertThat(after.finished).isTrue();
        assertThat(engine.ranking(next)).containsExactly(1, 0);
    }

    /**
     * 🔴 손패가 비어도 <b>펼쳐 둔 카드가 남아 있으면 아직 판에 있다.</b> 종을 맞게 치면
     * 되찾아 오므로, 여기서 빼면 되살아날 길이 사라진다.
     */
    @Test
    void 손패가_비어도_펼친_카드가_있으면_탈락하지_않는다() {
        HalliGalliState state = handMade();
        state.hands.get(0).clear();
        state.piles.get(0).addFirst(new HalliGalliCard("LIME", 2));

        Map<String, Object> next = engine.apply(codec.write(state), 0, new GameAction("FLIP", null, null));

        HalliGalliState after = codec.read(next, HalliGalliState.class);
        assertThat(after.isAlive(0)).isTrue();
        assertThat(after.finished).isFalse();
        // 뒤집지는 못하므로 차례만 넘어간다
        assertThat(after.turn).isEqualTo(1);
    }

    @Test
    void 손패가_비어도_펼친_카드가_있으면_종을_칠_수_있다() {
        HalliGalliState state = handMade();
        state.hands.get(0).clear();
        state.piles.get(0).addFirst(new HalliGalliCard("LIME", 3));
        state.piles.get(1).addFirst(new HalliGalliCard("LIME", 2));

        Map<String, Object> next = engine.apply(codec.write(state), 0, new GameAction("BELL", null, null));

        HalliGalliState after = codec.read(next, HalliGalliState.class);
        assertThat(after.lastBellCorrect).isTrue();
        // 되찾아 왔다
        assertThat(after.hands.get(0)).hasSize(2);
    }

    @Test
    void 손패도_펼친_카드도_없으면_종을_칠_수_없다() {
        HalliGalliState state = handMade();
        state.hands.get(0).clear();
        Map<String, Object> raw = codec.write(state);

        assertThatThrownBy(() -> engine.apply(raw, 0, new GameAction("BELL", null, null)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void 나간_사람은_꼴찌로_밀린다() {
        Map<String, Object> state = engine.start(3, OPTIONS);

        Map<String, Object> next = engine.retire(state, 0);

        assertThat(engine.ranking(next).getLast()).isZero();
    }

    /**
     * 🔴 남의 종에 더미까지 쓸려 가면 <b>그 순간</b> 끝난다.
     *
     * <p>예전에는 자기 차례에 뒤집을 때만 탈락을 봤다. 그런데 카드를 잃는 가장 흔한 길은
     * 자기 차례가 아니라 남이 종을 맞게 쳐서 모든 더미를 가져가는 것이고, 그 순간에는
     * 아무도 빼 주지 않았다 — 카드가 0 인데 살아 있는 자리가 남아 <b>혼자 남았는데도 판이
     * 끝나지 않았다.</b> 그 사람은 종도 못 치고 뒤집지도 못하는데 차례는 돌아와서,
     * 화면에 누를 수 있는 버튼이 하나도 없는 채로 멈췄다.
     */
    @Test
    void 남의_종에_카드를_다_뺏기면_그_자리에서_끝난다() {
        HalliGalliState state = handMade();
        // 0번은 펼쳐 둔 카드 한 장이 전부 — 손패는 비었다
        state.hands.get(0).clear();
        state.piles.get(0).addFirst(new HalliGalliCard("LIME", 2));
        // 1번이 칠 수 있게 합이 5가 되도록 맞춘다
        state.piles.get(1).addFirst(new HalliGalliCard("LIME", 3));

        Map<String, Object> next = engine.apply(codec.write(state), 1, new GameAction("BELL", null, null));

        HalliGalliState after = codec.read(next, HalliGalliState.class);
        assertThat(after.lastBellCorrect).isTrue();
        assertThat(after.isAlive(0)).as("카드를 다 뺏겼으면 그 자리에서 탈락이다").isFalse();
        assertThat(after.finished).as("혼자 남았으면 판이 끝난다").isTrue();
        assertThat(engine.ranking(next)).containsExactly(1, 0);
    }

    /** 카드를 마음대로 놓기 위한 2인 판 */
    private HalliGalliState handMade() {
        HalliGalliState state = codec.read(engine.start(2, OPTIONS), HalliGalliState.class);
        state.piles.forEach(List::clear);
        return state;
    }
}
