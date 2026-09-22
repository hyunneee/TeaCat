package com.teacat.server.game.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.game.engine.GameEngine;
import com.teacat.server.game.entity.GameType;
import com.teacat.server.game.exception.GameErrorCode;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * 게임 종류 → 규칙.
 *
 * <p>스프링이 찾아준 엔진들을 {@link GameEngine#type()} 으로 줄 세운다. 게임을 하나 더
 * 붙일 때 이 클래스는 건드리지 않는다 — {@code GameEngine} 구현에 {@code @Component} 만
 * 달면 된다. 단, {@code game_type} enum 에 값을 더하는 마이그레이션은 따로 필요하다.
 */
@Component
public class GameEngines {

    private final Map<GameType, GameEngine> byType = new EnumMap<>(GameType.class);

    public GameEngines(List<GameEngine> engines) {
        engines.forEach(engine -> byType.put(engine.type(), engine));
    }

    public GameEngine of(GameType type) {
        GameEngine engine = byType.get(type);
        if (engine == null) {
            // game_type 에 값은 있는데 엔진이 없다. 배포가 반만 나간 상태다
            throw new BusinessException(GameErrorCode.INVALID_ACTION);
        }
        return engine;
    }
}
