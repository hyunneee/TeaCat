package com.teacat.server.game.service;

import com.teacat.server.common.config.GamePolicyProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.game.engine.GameAction;
import com.teacat.server.game.engine.GameEngine;
import com.teacat.server.game.entity.GameParticipant;
import com.teacat.server.game.entity.GameRoom;
import com.teacat.server.game.entity.GameRoomStatus;
import com.teacat.server.game.entity.GameType;
import com.teacat.server.game.exception.GameErrorCode;
import com.teacat.server.game.repository.GameParticipantRepository;
import com.teacat.server.game.repository.GameRoomRepository;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 게임 방의 DB 쓰기.
 *
 * <p>여기 있는 메서드는 전부 <b>짧은 트랜잭션 하나</b>다. 체인에 다녀오는 일은 하지 않는다 —
 * 그건 커밋 뒤에 {@link GameSettlementService#pushToChain} 이 한다. 같은 이유로 SSE 도
 * 여기서 쏘지 않는다(롤백되면 "바뀌었다" 고 거짓말한 셈이 된다).
 * 이 분리는 resale 도메인의 SeatDrawWriter · ResaleDrawService 와 같은 모양이다.
 *
 * <p>🔴 게임판을 건드리는 메서드는 <b>반드시</b> {@code findByIdForUpdate} 로 시작한다.
 * 할리갈리의 종처럼 동시에 들어오는 요청을 줄 세우는 곳이 그 락이다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GameRoomWriter {

    /** 헷갈리는 글자(O·0·I·1)를 뺐다. 사람이 불러주고 받아 적는 코드다 */
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 6;
    private static final int CODE_ATTEMPTS = 20;

    private final GameRoomRepository roomRepository;
    private final GameParticipantRepository participantRepository;
    private final CatMoneyHoldService holdService;
    private final GameEngines engines;
    private final GameSettlementService settlement;
    private final GamePolicyProperties policy;
    private final SecureRandom random = new SecureRandom();

    /** 한 번의 쓰기가 끝난 뒤 바깥이 해야 할 일 */
    public record Outcome(Long roomId, boolean finished, List<Long> chainPushIds) {

        public static Outcome of(Long roomId) {
            return new Outcome(roomId, false, List.of());
        }
    }

    @Transactional
    public GameRoom create(Long userId, GameType gameType, long betAmount, int maxPlayers) {
        if (!policy.allowsBet(betAmount)) {
            throw new BusinessException(GameErrorCode.BET_NOT_ALLOWED);
        }
        if (!gameType.supports(maxPlayers)) {
            throw new BusinessException(GameErrorCode.INVALID_ACTION);
        }
        // 혼자 걸고 혼자 다 받으면 보조금이 공짜 돈이 된다. 혼자 하는 방은 연습뿐이다
        if (maxPlayers == 1 && betAmount > 0) {
            throw new BusinessException(GameErrorCode.SOLO_BET_NOT_ALLOWED);
        }
        requireNoOtherRoom(userId);

        GameRoom room = roomRepository.save(
                GameRoom.open(newInviteCode(), gameType, userId, betAmount, maxPlayers));
        seat(room, userId, 0);
        return room;
    }

    @Transactional
    public GameRoom join(Long userId, String inviteCode) {
        GameRoom room = roomRepository.findOpenByInviteCode(inviteCode.trim().toUpperCase())
                .orElseThrow(() -> new BusinessException(GameErrorCode.ROOM_NOT_FOUND));

        // 방을 잠그고 다시 읽는다. 마지막 한 자리에 두 명이 동시에 들어오는 것을 막는다
        GameRoom locked = roomRepository.findByIdForUpdate(room.getId())
                .orElseThrow(() -> new BusinessException(GameErrorCode.ROOM_NOT_FOUND));
        if (!locked.getStatus().isOpen()) {
            throw new BusinessException(GameErrorCode.ROOM_ALREADY_STARTED);
        }

        if (participantRepository.findByRoomIdAndUserId(locked.getId(), userId).isPresent()) {
            return locked;
        }
        requireNoOtherRoom(userId);

        List<GameParticipant> seated = participantRepository.findByRoomIdOrderBySeatNo(locked.getId());
        if (seated.size() >= locked.getMaxPlayers()) {
            throw new BusinessException(GameErrorCode.ROOM_FULL);
        }
        seat(locked, userId, participantRepository.maxSeatNo(locked.getId()) + 1);
        return locked;
    }

    @Transactional
    public Outcome setReady(Long userId, Long roomId, boolean ready) {
        GameRoom room = lock(roomId);
        participant(room.getId(), userId).toggleReady(ready);
        return Outcome.of(room.getId());
    }

    /**
     * 게임을 시작한다.
     *
     * <p>판돈은 <b>방에 들어올 때</b> 이미 묶여 있다. 여기서는 그것을 참가 기록에 베껴
     * 두기만 한다 — 시작 뒤에 방 설정이 바뀌어도 이 판의 판돈은 그대로여야 한다.
     */
    @Transactional
    public Outcome start(Long userId, Long roomId) {
        GameRoom room = lock(roomId);
        if (!room.isHost(userId)) {
            throw new BusinessException(GameErrorCode.NOT_HOST);
        }
        if (!room.getStatus().isOpen()) {
            throw new BusinessException(GameErrorCode.ROOM_ALREADY_STARTED);
        }

        List<GameParticipant> seated = participantRepository.findByRoomIdOrderBySeatNo(room.getId());
        // 방장은 시작 버튼을 누른 것이 준비를 대신한다
        boolean allReady = seated.stream().allMatch(p -> p.isReady() || room.isHost(p.getUserId()));
        if (!allReady) {
            throw new BusinessException(GameErrorCode.NOT_ALL_READY);
        }

        GameEngine engine = engines.of(room.getGameType());
        seated.forEach(p -> p.startPlaying(room.getBetAmount()));
        room.start(engine.start(seated.size()), engine.turnLimit());
        return Outcome.of(room.getId());
    }

    /** 플레이어의 한 수. 판이 끝나면 정산까지 여기서 마치고, 체인에 밀 대상만 밖으로 넘긴다 */
    @Transactional
    public Outcome act(Long userId, Long roomId, GameAction action) {
        GameRoom room = lock(roomId);
        if (room.getStatus() != GameRoomStatus.PLAYING) {
            throw new BusinessException(GameErrorCode.ROOM_NOT_PLAYING);
        }
        GameParticipant me = participant(room.getId(), userId);

        GameEngine engine = engines.of(room.getGameType());
        Map<String, Object> next = engine.apply(room.getState(), me.getSeatNo(), action);
        room.updateState(next, engine.turnLimit());

        return finishIfOver(room, engine);
    }

    /** 시간을 넘긴 판을 대신 진행시킨다 */
    @Transactional
    public Outcome autoAdvance(Long roomId) {
        GameRoom room = lock(roomId);
        if (room.getStatus() != GameRoomStatus.PLAYING || room.getTurnExpiresAt() == null
                || room.getTurnExpiresAt().isAfter(LocalDateTime.now())) {
            return Outcome.of(roomId);
        }
        GameEngine engine = engines.of(room.getGameType());
        room.updateState(engine.autoAdvance(room.getState()), engine.turnLimit());
        return finishIfOver(room, engine);
    }

    /**
     * 방을 떠난다.
     *
     * <p>시작 전이면 판돈을 돌려주고 자리를 비운다. 시작 뒤면 <b>돌려주지 않는다</b> —
     * 돌려주면 지고 있을 때 나가면 그만이라 남은 사람이 딸 돈이 사라진다.
     */
    @Transactional
    public Outcome leave(Long userId, Long roomId) {
        GameRoom room = lock(roomId);
        GameParticipant me = participant(room.getId(), userId);

        if (room.getStatus().isOpen()) {
            me.retire();
            holdService.release(CatMoneyHoldRefType.GAME_BET, me.getId());

            List<GameParticipant> left = participantRepository.findAliveInRoom(room.getId());
            if (left.isEmpty()) {
                room.abort();
            } else if (room.isHost(userId)) {
                room.handOverHost(left.getFirst().getUserId());
            }
            return Outcome.of(room.getId());
        }

        if (room.getStatus() != GameRoomStatus.PLAYING) {
            return Outcome.of(room.getId());
        }

        me.retire();
        GameEngine engine = engines.of(room.getGameType());
        room.updateState(engine.retire(room.getState(), me.getSeatNo()), engine.turnLimit());
        return finishIfOver(room, engine);
    }

    /** 만들어 놓고 아무도 안 온 방을 닫는다. 판돈이 묶인 채로 방치되지 않게 한다 */
    @Transactional
    public Outcome abortAbandoned(Long roomId) {
        GameRoom room = lock(roomId);
        if (!room.getStatus().isOpen()) {
            return Outcome.of(roomId);
        }
        List<GameParticipant> seated = participantRepository.findByRoomIdOrderBySeatNo(room.getId());
        settlement.refundAll(seated);
        seated.forEach(GameParticipant::retire);
        room.abort();
        return Outcome.of(roomId);
    }

    /* ── 도우미 ───────────────────────────────────────────── */

    private Outcome finishIfOver(GameRoom room, GameEngine engine) {
        if (!engine.isFinished(room.getState())) {
            return Outcome.of(room.getId());
        }
        List<GameParticipant> all = participantRepository.findByRoomIdOrderBySeatNo(room.getId());
        settlement.recordPayouts(room, all, engine.ranking(room.getState()), room.getState());

        List<Long> toPush = all.stream()
                .filter(p -> !p.isChainSettled())
                .map(GameParticipant::getId)
                .toList();
        return new Outcome(room.getId(), true, toPush);
    }

    private void seat(GameRoom room, Long userId, int seatNo) {
        GameParticipant participant = participantRepository.save(
                GameParticipant.join(room.getId(), userId, seatNo));

        if (!room.isPractice()) {
            // 방에 들어오는 순간 판돈을 묶는다. 시작할 때 묶으면 그 사이에 다 써버린 사람
            // 때문에 시작 자체가 실패한다. 나가면 그대로 풀린다
            holdService.hold(userId, room.getBetAmount(), CatMoneyHoldRefType.GAME_BET, participant.getId());
        }
    }

    private GameRoom lock(Long roomId) {
        return roomRepository.findByIdForUpdate(roomId)
                .orElseThrow(() -> new BusinessException(GameErrorCode.ROOM_NOT_FOUND));
    }

    private GameParticipant participant(Long roomId, Long userId) {
        return participantRepository.findByRoomIdAndUserId(roomId, userId)
                .orElseThrow(() -> new BusinessException(GameErrorCode.NOT_PARTICIPANT));
    }

    /** 판돈이 두 방에 묶이면 어느 쪽도 정산할 수 없다 */
    private void requireNoOtherRoom(Long userId) {
        if (participantRepository.findCurrentRoomOf(userId).isPresent()) {
            throw new BusinessException(GameErrorCode.ALREADY_IN_ROOM);
        }
    }

    private String newInviteCode() {
        for (int attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
            StringBuilder code = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                code.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            String candidate = code.toString();
            if (!roomRepository.isCodeTaken(candidate)) {
                return candidate;
            }
        }
        // 32^6 가지에서 20번을 내리 부딪혔다. 사실상 일어나지 않는다
        log.error("초대 코드를 뽑지 못했습니다. 살아 있는 방이 비정상적으로 많습니다");
        throw new BusinessException(GameErrorCode.INVITE_CODE_EXHAUSTED);
    }
}
