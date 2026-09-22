package com.teacat.server.game.engine;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.game.exception.GameErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

/**
 * 게임판 JSON 과 엔진이 쓰는 객체 사이를 오간다.
 *
 * <p>컬럼 하나에 게임 두 종류가 들어가서 엔티티는 {@code Map} 으로만 들고 있다. 엔진이
 * 자기 타입으로 바꿔 쓰는 지점이 여기다.
 *
 * <p>🔴 읽기 실패를 조용히 넘기지 않는다. 배포 중에 스키마가 바뀌면 진행 중이던 판의
 * JSON 이 새 코드가 모르는 모양일 수 있는데, 그때 빈 판을 만들어 주면 <b>말이 전부
 * 처음으로 돌아가고 판돈은 그대로</b> 인 상태가 된다. 차라리 500 으로 멈춰 세운다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GameStateCodec {

    private final ObjectMapper objectMapper;

    public <T> T read(Map<String, Object> state, Class<T> type) {
        if (state == null) {
            throw new BusinessException(GameErrorCode.STATE_CORRUPTED);
        }
        try {
            return objectMapper.convertValue(state, type);
        } catch (RuntimeException e) {
            // 게임판에는 개인정보가 없다. 말 위치와 카드뿐이라 로그로 남겨도 된다
            log.error("게임 상태를 읽지 못했습니다. type={}", type.getSimpleName(), e);
            throw new BusinessException(GameErrorCode.STATE_CORRUPTED);
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> write(Object state) {
        return objectMapper.convertValue(state, Map.class);
    }
}
