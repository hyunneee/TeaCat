package com.teacat.server.game.engine;

import com.teacat.server.game.entity.GameType;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * 게임 규칙 한 벌.
 *
 * <p>🔴 <b>엔진은 상태를 갖지 않는다.</b> 게임판은 전부 인자로 들어오고 인자로 나간다.
 * 서버 메모리에 판을 들고 있으면 재시작에 날아가고, 인스턴스가 늘면 갈라진다.
 * 진실은 {@code game_rooms.state} 한 곳이다.
 *
 * <p>판은 {@code Map<String, Object>} 로 주고받는다. 컬럼 하나에 게임 여러 종류가 들어가서
 * 엔티티가 특정 게임 타입을 알 수 없기 때문이다. 타입 있는 객체로 바꾸는 일은 각 엔진이 한다.
 */
public interface GameEngine {

    GameType type();

    /** 시작 판. players 는 자리 수(1..4), options 는 방을 만들 때 고른 값들 */
    Map<String, Object> start(int players, GameOptions options);

    /**
     * 한 사람의 행동을 적용한다.
     *
     * @param seat 행동한 사람의 자리 번호. 차례가 아니면 엔진이 거절한다
     * @throws com.teacat.server.common.exception.BusinessException 규칙에 어긋나는 행동일 때
     */
    Map<String, Object> apply(Map<String, Object> state, int seat, GameAction action);

    /** 한 턴에 허용하는 시간. 이 시간을 넘기면 스위퍼가 {@link #autoAdvance} 를 부른다 */
    Duration turnLimit();

    /**
     * 지금 상태에서 허용하는 시간. 한 턴이 여러 단계인 게임은 단계마다 다를 수 있다
     * (윷놀이의 던지기 10초 · 옮기기 60초).
     *
     * <p>기본은 {@link #turnLimit()} 그대로다 — 단계가 하나인 게임은 덮어쓸 필요가 없다.
     */
    default Duration turnLimit(Map<String, Object> state) {
        return turnLimit();
    }

    /** 아무도 진행시키지 않는 판을 대신 진행시킨다. 판이 영원히 멈춰 판돈이 묶이는 것을 막는다 */
    Map<String, Object> autoAdvance(Map<String, Object> state);

    /** 판을 떠난 사람을 반영한다. 남은 사람만으로 끝낼 수 있으면 여기서 끝난다 */
    Map<String, Object> retire(Map<String, Object> state, int seat);

    boolean isFinished(Map<String, Object> state);

    /**
     * 끝난 판의 등수.
     *
     * @return 앞에서부터 1등, 2등 … 인 자리 번호. 같은 등수는 두지 않는다
     */
    List<Integer> ranking(Map<String, Object> state);
}
