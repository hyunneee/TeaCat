package com.teacat.server.game.engine.yut;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class YutBoardTests {

    @Test
    void 판_밖에서_도를_내면_첫_밭에_선다() {
        assertThat(YutBoard.advance(YutBoard.HOME, 1)).isZero();
        assertThat(YutBoard.advance(YutBoard.HOME, 2)).isEqualTo(1);
    }

    @Test
    void 모가_나오면_첫_모서리에_정확히_선다() {
        assertThat(YutBoard.advance(YutBoard.HOME, 5)).isEqualTo(4);
    }

    @Test
    void 첫_모서리에_서면_지름길로_빠진다() {
        assertThat(YutBoard.advance(4, 1)).isEqualTo(19);
        assertThat(YutBoard.advance(4, 3)).isEqualTo(YutBoard.CENTER);
    }

    @Test
    void 모서리를_지나가기만_하면_지름길을_타지_않는다() {
        // 2번 밭에서 걸(3)이면 5번 밭이다. 4번 모서리를 밟고 지나갔을 뿐이다
        assertThat(YutBoard.advance(2, 3)).isEqualTo(5);
    }

    @Test
    void 중앙에_멈추면_언제나_도착으로_직행한다() {
        // 지름길 1로 들어왔더라도 중앙에서는 짧은 쪽(지름길 2의 출구)으로 나간다
        assertThat(YutBoard.advance(YutBoard.CENTER, 1)).isEqualTo(26);
        assertThat(YutBoard.advance(YutBoard.CENTER, 3)).isEqualTo(YutBoard.GOAL);
    }

    @Test
    void 중앙을_지나가기만_하면_원래_지름길을_이어간다() {
        // 19번에서 걸(3)이면 중앙을 지나 22번이다 — 도착 쪽으로 새지 않는다
        assertThat(YutBoard.advance(19, 3)).isEqualTo(22);
        // 그 지름길은 모서리 14로 나온다
        assertThat(YutBoard.advance(4, 6)).isEqualTo(14);
    }

    @Test
    void 두번째_모서리_지름길은_도착으로_이어진다() {
        assertThat(YutBoard.advance(9, 3)).isEqualTo(YutBoard.CENTER);
        assertThat(YutBoard.advance(9, 6)).isEqualTo(YutBoard.GOAL);
    }

    @Test
    void 가장_짧은_길은_열한_칸이다() {
        int position = YutBoard.advance(YutBoard.HOME, 5);   // 모 → 모서리 4
        assertThat(position).isEqualTo(4);
        position = YutBoard.advance(position, 3);            // 걸 → 중앙
        assertThat(position).isEqualTo(YutBoard.CENTER);
        position = YutBoard.advance(position, 3);            // 걸 → 도착
        assertThat(position).isEqualTo(YutBoard.GOAL);
    }

    @Test
    void 바깥으로만_돌면_스무_칸이다() {
        // 모서리에 서면 지름길로 빠지므로, 바깥 길만 세려면 모서리를 밟지 않고 지나야 한다.
        // 도(1)로 한 칸씩 가되 모서리 직전에서 개(2)로 건너뛴다
        int position = YutBoard.HOME;
        int steps = 0;
        while (position != YutBoard.GOAL) {
            boolean cornerNext = position + 1 == 4 || position + 1 == 9 || position + 1 == 14;
            int move = cornerNext ? 2 : 1;
            position = YutBoard.advance(position, move);
            steps += move;
        }
        assertThat(steps).isEqualTo(20);
    }

    @Test
    void 도착을_지나쳐도_완주다() {
        assertThat(YutBoard.advance(18, 5)).isEqualTo(YutBoard.GOAL);
    }

    @Test
    void 대기_중이거나_완주한_말은_판_위에_없다() {
        assertThat(YutBoard.isOnBoard(YutBoard.HOME)).isFalse();
        assertThat(YutBoard.isOnBoard(YutBoard.GOAL)).isFalse();
        assertThat(YutBoard.isOnBoard(YutBoard.CENTER)).isTrue();
    }
}
