package com.teacat.server.game.service;

import com.teacat.server.game.entity.GameParticipant;
import com.teacat.server.game.repository.GameParticipantRepository;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 체인 반영이 끝난 정산을 장부에 표시한다.
 *
 * <p>🔴 <b>{@link GameSettlementService} 와 분리된 이유가 있다.</b> 그쪽의
 * {@code pushToChain} 은 체인에 다녀오느라 {@code NOT_SUPPORTED}(트랜잭션 없음)인데,
 * 같은 클래스 안의 {@code @Transactional} 메서드를 직접 부르면 <b>스프링 프록시를 타지
 * 않아 트랜잭션이 열리지 않는다.</b> 그러면 홀드 해제({@code MANDATORY})가
 * {@code No existing transaction found} 로 터진다 — 실제로 한 번 터뜨리고 옮겼다.
 */
@Service
@RequiredArgsConstructor
public class GameSettlementWriter {

    private final GameParticipantRepository participantRepository;
    private final CatMoneyHoldService holdService;

    @Transactional
    public void finishChainSettlement(Long participantId) {
        GameParticipant participant = participantRepository.findById(participantId).orElse(null);
        if (participant == null || participant.isChainSettled()) {
            return;
        }
        // 홀드는 여기서야 푼다. 체인 반영 전에 풀면 그 사이에 돈을 다 써버릴 수 있고,
        // 그러면 태울 잔액이 없어 진 사람의 판돈을 회수하지 못한다
        holdService.release(CatMoneyHoldRefType.GAME_BET, participant.getId());
        participant.markChainSettled();
    }
}
