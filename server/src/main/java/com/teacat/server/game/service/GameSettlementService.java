package com.teacat.server.game.service;

import com.teacat.server.common.config.GamePolicyProperties;
import com.teacat.server.game.entity.GameParticipant;
import com.teacat.server.game.entity.GameRoom;
import com.teacat.server.game.repository.GameParticipantRepository;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import com.teacat.server.wallet.entity.CatTxReason;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import com.teacat.server.wallet.service.CatMoneyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 끝난 판의 돈을 나눈다.
 *
 * <p><b>두 걸음이다.</b> 먼저 방 트랜잭션 안에서 등수와 받을 금액을 장부에 적고
 * ({@link #recordPayouts}), 커밋한 뒤에 체인을 움직인다 ({@link #pushToChain}).
 * 체인 왕복이 최대 20초라 DB 커넥션을 쥔 채로 하면 풀이 마른다 — wallet 도메인이
 * 같은 이유로 mint/burn 을 트랜잭션 밖에 두고 있다.
 *
 * <p>🔴 <b>판돈 전체가 아니라 순손익만 옮긴다.</b> 이긴 사람은 (받을 돈 − 낸 돈) 만큼
 * 발행하고, 진 사람은 (낸 돈 − 받을 돈) 만큼 태운다. 전액을 태웠다가 다시 발행하면
 * 체인 왕복이 두 배가 되고, 중간에 하나만 실패했을 때 원장이 한쪽으로 기운다.
 * 이 방식에서 새로 생기는 돈은 정확히 보조금과 같다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GameSettlementService {

    private final GameParticipantRepository participantRepository;
    private final CatMoneyService catMoneyService;
    private final CatMoneyHoldService holdService;
    private final GameSettlementWriter settlementWriter;
    private final GamePolicyProperties policy;

    /**
     * 등수와 받을 금액을 적고 방을 닫는다. <b>방 트랜잭션 안에서</b> 불러야 한다.
     *
     * @param rankingSeats 앞에서부터 1등인 자리 번호
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void recordPayouts(GameRoom room, List<GameParticipant> participants,
            List<Integer> rankingSeats, Map<String, Object> finalState) {

        Map<Integer, GameParticipant> bySeat = new java.util.HashMap<>();
        participants.forEach(p -> bySeat.put(p.getSeatNo(), p));

        List<GameParticipant> ordered = new ArrayList<>();
        rankingSeats.stream().map(bySeat::get).filter(java.util.Objects::nonNull).forEach(ordered::add);
        // 엔진이 빠뜨린 자리가 있으면 뒤에 붙인다. 정산에서 누락되면 판돈이 영영 묶인다
        participants.stream().filter(p -> !ordered.contains(p)).forEach(ordered::add);

        long subsidy = grantableSubsidy(ordered);
        long pot = ordered.stream().mapToLong(GameParticipant::getBet).sum() + subsidy;

        List<Long> payouts = splitPot(pot, ordered.size());
        // 보조금은 "누구 몫으로 찍어냈나" 로 기록한다. 받은 금액이 아니라 만들어진 금액이
        // 하루 한도의 기준이다 — 총량이 얼마나 늘었는지가 막아야 할 값이기 때문이다
        long perPlayerSubsidy = ordered.isEmpty() ? 0 : subsidy / ordered.size();
        long subsidyRemainder = ordered.isEmpty() ? 0 : subsidy - perPlayerSubsidy * ordered.size();

        for (int i = 0; i < ordered.size(); i++) {
            long share = perPlayerSubsidy + (i == 0 ? subsidyRemainder : 0);
            ordered.get(i).settle(i + 1, payouts.get(i), share);
            ordered.get(i).finishPlaying();
        }
        room.finish(finalState, pot, subsidy);
    }

    /**
     * 장부에 적힌 순손익을 체인에 반영하고 홀드를 푼다. <b>트랜잭션 밖에서</b> 돈다.
     *
     * <p>{@code operationKey} 가 참가 id 로 고정이라 몇 번을 다시 불러도 한 번만 반영된다.
     * 스위퍼가 실패한 건을 그대로 다시 민다.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void pushToChain(Long participantId) {
        GameParticipant participant = participantRepository.findById(participantId).orElse(null);
        if (participant == null || !participant.isSettled() || participant.isChainSettled()) {
            return;
        }

        long delta = participant.netDelta();
        String key = "game:" + participant.getRoomId() + ":settle:" + participant.getId();

        try {
            if (delta > 0) {
                catMoneyService.mint(participant.getUserId(), BigInteger.valueOf(delta),
                        CatTxReason.GAME_PRIZE, key);
            } else if (delta < 0) {
                catMoneyService.burn(participant.getUserId(), BigInteger.valueOf(-delta),
                        CatTxReason.GAME_BET, key);
            }
        } catch (RuntimeException e) {
            // 홀드를 풀지 않고 나간다. 묶인 채로 남아야 다음 스위퍼가 다시 시도할 때
            // 태울 돈이 남아 있다. 사람 눈에 띄도록 ERROR 로 남긴다 (Sentry 로 올라간다)
            log.error("게임 정산을 체인에 반영하지 못했습니다. participantId={}, delta={}",
                    participantId, delta, e);
            return;
        }
        // 🔴 같은 클래스의 @Transactional 메서드를 직접 부르면 프록시를 타지 않아
        //    트랜잭션이 열리지 않는다. 그래서 다른 빈에 두었다
        settlementWriter.finishChainSettlement(participantId);
    }

    /**
     * 이번 판에 실제로 얹어줄 보조금.
     *
     * <p>1인당 정액이되 <b>하루 한도</b>에 걸리면 그만큼만 준다. 한도가 없으면 계정 두 개로
     * 판을 계속 돌리는 것만으로 캣머니가 무한히 생긴다. 한도에 걸려도 판은 그대로 돌아가고
     * 참가자들이 낸 판돈은 온전히 나뉜다 — 보조금만 줄어든다.
     */
    private long grantableSubsidy(List<GameParticipant> participants) {
        // 혼자 하는 판과 연습 판은 보조금이 없다. 혼자면 낸 돈을 그대로 돌려받으면서
        // 보조금만 챙기는 공짜 수급이 된다
        if (participants.size() < 2 || participants.stream().allMatch(p -> p.getBet() == 0)) {
            return 0;
        }
        // 🔴 판돈이 너무 적은 판에도 얹어주면, 1 캣머니짜리 판을 계속 돌리는 것만으로
        //    보조금이 순이익이 된다. 판돈을 자유 입력으로 연 대신 이 선을 그었다
        //    (GamePolicyProperties.subsidyMinBet). 판은 그대로 돌아가고 보조금만 빠진다
        if (participants.stream().anyMatch(p -> p.getBet() < policy.subsidyMinBet())) {
            return 0;
        }

        LocalDateTime from = LocalDate.now().atStartOfDay();
        LocalDateTime to = from.plusDays(1);

        long total = 0;
        for (GameParticipant participant : participants) {
            long usedToday = participantRepository.sumSubsidyBetween(participant.getUserId(), from, to);
            long remaining = Math.max(0, policy.subsidyDailyCap() - usedToday);
            total += Math.min(policy.subsidyPerPlayer(), remaining);
        }
        return total;
    }

    /**
     * 판돈을 등수별로 나눈다.
     *
     * <p>정수로 나누면 남는 돈이 생긴다. 버리면 판돈 합계와 지급 합계가 어긋나 원장이
     * 맞지 않으므로 <b>나머지는 1등에게</b> 보낸다.
     */
    private List<Long> splitPot(long pot, int players) {
        List<Integer> shares = policy.sharesFor(players);
        List<Long> payouts = new ArrayList<>();
        long handedOut = 0;

        for (int i = 0; i < players; i++) {
            long amount = i < shares.size() ? pot * shares.get(i) / 100 : 0;
            payouts.add(amount);
            handedOut += amount;
        }
        if (!payouts.isEmpty()) {
            payouts.set(0, payouts.getFirst() + (pot - handedOut));
        }
        return payouts;
    }

    /** 판이 깨졌을 때 — 아무도 잃지도 얻지도 않는다. 홀드만 풀고 끝낸다 */
    @Transactional(propagation = Propagation.MANDATORY)
    public void refundAll(List<GameParticipant> participants) {
        for (GameParticipant participant : participants) {
            participant.settle(0, participant.getBet(), 0);
            holdService.release(CatMoneyHoldRefType.GAME_BET, participant.getId());
            participant.markChainSettled();
        }
    }

    /** 자정 기준 하루 한도에서 이 사람이 아직 받을 수 있는 보조금 */
    @Transactional(readOnly = true)
    public long remainingSubsidyToday(Long userId) {
        LocalDateTime from = LocalDate.now().atStartOfDay();
        return Math.max(0, policy.subsidyDailyCap()
                - participantRepository.sumSubsidyBetween(userId, from, from.plusDays(1)));
    }

}
