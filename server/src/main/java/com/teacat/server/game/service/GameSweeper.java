package com.teacat.server.game.service;

import com.teacat.server.common.config.GamePolicyProperties;
import com.teacat.server.game.entity.GameParticipant;
import com.teacat.server.game.entity.GameRoom;
import com.teacat.server.game.repository.GameParticipantRepository;
import com.teacat.server.game.repository.GameRoomRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 판이 멈추거나 정산이 밀린 것을 훑는다.
 *
 * <p>세 가지를 본다.
 * <ul>
 *   <li><b>멈춘 판</b> — 차례인 사람이 앱을 꺼버리면 아무도 진행시키지 않는다. 그동안
 *       모두의 판돈이 묶여 있으므로 서버가 대신 둔다.
 *   <li><b>버려진 대기방</b> — 만들어 놓고 아무도 안 온 방. 판돈만 묶고 있다.
 *   <li><b>밀린 체인 반영</b> — 블록체인 서비스가 잠깐 죽어 있었으면 여기 쌓인다.
 *       {@code operationKey} 가 참가 id 로 고정이라 몇 번을 다시 밀어도 한 번만 반영된다.
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "game.sweep-enabled", havingValue = "true", matchIfMissing = true)
public class GameSweeper {

    private final GameRoomRepository roomRepository;
    private final GameParticipantRepository participantRepository;
    private final GameRoomService roomService;
    private final GameSettlementService settlement;
    private final GamePolicyProperties policy;

    @Scheduled(fixedDelayString = "${game.turn-sweep-interval:PT3S}")
    public void sweep() {
        advanceStalledRooms();
        closeAbandonedRooms();
        retryChainSettlements();
    }

    private void advanceStalledRooms() {
        List<GameRoom> stalled = roomRepository.findStalledRooms(LocalDateTime.now());
        for (GameRoom room : stalled) {
            try {
                roomService.autoAdvance(room.getId());
            } catch (RuntimeException e) {
                // 한 방이 터져도 나머지는 계속 돌려야 한다
                log.error("멈춘 판을 진행시키지 못했습니다. roomId={}", room.getId(), e);
            }
        }
    }

    private void closeAbandonedRooms() {
        LocalDateTime before = LocalDateTime.now().minus(policy.abandonAfter());
        for (GameRoom room : roomRepository.findAbandonedWaitingRooms(before)) {
            try {
                roomService.abortAbandoned(room.getId());
            } catch (RuntimeException e) {
                log.error("버려진 방을 닫지 못했습니다. roomId={}", room.getId(), e);
            }
        }
    }

    private void retryChainSettlements() {
        List<GameParticipant> pending = participantRepository.findPendingChainSettlements();
        for (GameParticipant participant : pending) {
            // pushToChain 이 스스로 실패를 ERROR 로 남기고 홀드를 그대로 둔다.
            // 여기서는 다시 밀기만 한다
            settlement.pushToChain(participant.getId());
        }
    }
}
