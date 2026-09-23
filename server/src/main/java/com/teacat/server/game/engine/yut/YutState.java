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

    /** 방을 만들 때 안 고르면 쓰는 말 수 */
    public static final int DEFAULT_PIECES = 4;

    /** 이 판에서 한 사람이 쓰는 말 수. 방을 만들 때 정한다 */
    public int piecesPerPlayer = DEFAULT_PIECES;

    /**
     * 방금 던진 결과. 화면 한가운데에 크게 띄워 <b>다른 사람도 보게</b> 한다.
     *
     * <p>쓴 결과는 {@link #pending} 에서 빠지므로 그것만으로는 "방금 무엇이 나왔나" 를
     * 알 수 없다 — 도가 나오자마자 말을 옮기면 화면에 아무것도 안 남는다.
     */
    public Integer lastThrow;
    public Integer lastThrowSeat;
    /** 던질 때마다 하나씩 오른다. 같은 값이 연달아 나와도 화면이 새 던지기로 알아본다 */
    public int throwSeq;

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

    /** 말을 모두 뺀 순서대로 쌓이는 자리 번호. 이게 곧 등수다 */
    public List<Integer> finishOrder = new ArrayList<>();

    /** 화면에 흘려줄 짧은 기록. 최근 것만 남긴다 */
    public List<String> log = new ArrayList<>();

    public boolean finished;

    public static YutState start(int players, int piecesPerPlayer) {
        YutState state = new YutState();
        state.players = players;
        state.piecesPerPlayer = piecesPerPlayer;
        state.turn = 0;
        for (int seat = 0; seat < players; seat++) {
            List<Integer> mine = new ArrayList<>();
            for (int i = 0; i < piecesPerPlayer; i++) {
                mine.add(YutBoard.HOME);
            }
            state.pieces.add(mine);
            state.retired.add(false);
        }
        return state;
    }

    /** 이 자리가 아직 꺼내지 않은 말 수 */
    public int waitingCount(int seat) {
        return (int) pieces.get(seat).stream().filter(p -> p == YutBoard.HOME).count();
    }

    /** 이 자리가 완주시킨 말 수 */
    public int finishedCount(int seat) {
        return (int) pieces.get(seat).stream().filter(p -> p == YutBoard.GOAL).count();
    }

    /** 판 위에 나와 있는 말 수 */
    public int onBoardCount(int seat) {
        return (int) pieces.get(seat).stream().filter(YutBoard::isOnBoard).count();
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
