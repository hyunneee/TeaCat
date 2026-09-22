package com.teacat.server.game.engine.yut;

import java.util.ArrayList;
import java.util.List;

/**
 * 윷놀이 게임판 한 장. game_rooms.state 에 JSON 으로 통째로 들어간다.
 *
 * <p>가변 컬렉션을 쓴다. 엔진이 한 번의 행동마다 이 객체를 고쳐서 그대로 다시 저장하기
 * 때문이다 — 매번 통째로 복사할 만큼 크지 않고, 트랜잭션 안에서만 산다.
 */
public class YutState {

    /** 한 사람이 가진 말 수 */
    public static final int PIECES = 4;

    /** 지금 차례인 자리 번호 */
    public int turn;

    /** 자리 수. 중간에 나간 사람이 있어도 줄지 않는다 (자리 번호가 곧 인덱스라서) */
    public int players;

    /** [자리][말] = 칸 번호. -1 대기, 29 완주 */
    public List<List<Integer>> pieces = new ArrayList<>();

    /** 이번 턴에 아직 던질 수 있나. 윷·모가 나오거나 말을 잡으면 다시 true 가 된다 */
    public boolean canThrow = true;

    /** 던져 놓고 아직 안 쓴 결과들. 윷이 연달아 나오면 여러 개가 쌓인다 */
    public List<Integer> pending = new ArrayList<>();

    /** 이 자리가 판을 떠났나. 남은 말은 그대로 두고 차례만 건너뛴다 */
    public List<Boolean> retired = new ArrayList<>();

    /** 말 4개를 모두 뺀 순서대로 쌓이는 자리 번호. 이게 곧 등수다 */
    public List<Integer> finishOrder = new ArrayList<>();

    /** 화면에 흘려줄 짧은 기록. 최근 것만 남긴다 */
    public List<String> log = new ArrayList<>();

    public boolean finished;

    public static YutState start(int players) {
        YutState state = new YutState();
        state.players = players;
        state.turn = 0;
        for (int seat = 0; seat < players; seat++) {
            List<Integer> mine = new ArrayList<>();
            for (int i = 0; i < PIECES; i++) {
                mine.add(YutBoard.HOME);
            }
            state.pieces.add(mine);
            state.retired.add(false);
        }
        return state;
    }

    public boolean isRetired(int seat) {
        return seat >= 0 && seat < retired.size() && Boolean.TRUE.equals(retired.get(seat));
    }

    public boolean hasFinished(int seat) {
        return finishOrder.contains(seat);
    }

    /** 아직 차례가 돌아올 수 있는 자리인가 */
    public boolean isPlayable(int seat) {
        return !isRetired(seat) && !hasFinished(seat);
    }

    public void addLog(String line) {
        log.add(line);
        while (log.size() > 30) {
            log.removeFirst();
        }
    }
}
