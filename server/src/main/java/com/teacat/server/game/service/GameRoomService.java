package com.teacat.server.game.service;

import com.teacat.server.common.config.GamePolicyProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.game.dto.request.CreateGameRoomRequest;
import com.teacat.server.game.dto.request.GameActionRequest;
import com.teacat.server.game.dto.response.GameParticipantResponse;
import com.teacat.server.game.dto.response.GamePolicyResponse;
import com.teacat.server.game.dto.response.GameRoomResponse;
import com.teacat.server.game.engine.GameAction;
import com.teacat.server.game.entity.GameParticipant;
import com.teacat.server.game.entity.GamePieceStyle;
import com.teacat.server.game.entity.GameRoom;
import com.teacat.server.game.entity.GameType;
import com.teacat.server.game.exception.GameErrorCode;
import com.teacat.server.game.repository.GameParticipantRepository;
import com.teacat.server.game.repository.GameRoomRepository;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 게임 방의 바깥쪽.
 *
 * <p>DB 쓰기는 {@link GameRoomWriter} 가 트랜잭션 하나로 끝내고, 여기서는 <b>커밋된
 * 뒤에야 할 수 있는 일</b>만 한다 — 체인에 순손익을 밀고, 방을 보고 있는 사람들에게
 * 바뀌었다고 알린다. 트랜잭션 안에서 SSE 를 쏘면 롤백됐을 때 거짓말이 되고, 체인을
 * 부르면 DB 커넥션을 20초씩 쥔다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GameRoomService {

    private final GameRoomWriter writer;
    private final GameSettlementService settlement;
    private final GameEventBroker broker;
    private final GameRoomRepository roomRepository;
    private final GameParticipantRepository participantRepository;
    private final UserRepository userRepository;
    private final GamePolicyProperties policy;

    /* ── 방 ───────────────────────────────────────────────── */

    public GameRoomResponse create(Long userId, CreateGameRoomRequest request) {
        GameRoom room = writer.create(userId, request.gameType(), request.betAmount(),
                request.maxPlayers(), request.piecesOrDefault());
        return view(userId, room.getId());
    }

    public GameRoomResponse join(Long userId, String inviteCode) {
        GameRoom room = writer.join(userId, inviteCode);
        broker.publish(room.getId(), "room");
        return view(userId, room.getId());
    }

    public GameRoomResponse setReady(Long userId, Long roomId, boolean ready) {
        return after(userId, writer.setReady(userId, roomId, ready), "room");
    }

    public GameRoomResponse setPieceStyle(Long userId, Long roomId, GamePieceStyle style) {
        return after(userId, writer.setPieceStyle(userId, roomId, style), "room");
    }

    public GameRoomResponse start(Long userId, Long roomId) {
        return after(userId, writer.start(userId, roomId), "start");
    }

    public GameRoomResponse act(Long userId, Long roomId, GameActionRequest request) {
        GameAction action = new GameAction(request.action(), request.piece(), request.value());
        return after(userId, writer.act(userId, roomId, action), "state");
    }

    public void leave(Long userId, Long roomId) {
        after(userId, writer.leave(userId, roomId), "room");
    }

    /** 스위퍼가 부른다. 멈춘 판을 대신 진행시키고 결과를 방에 알린다 */
    public void autoAdvance(Long roomId) {
        publishAndPush(writer.autoAdvance(roomId), "state");
    }

    public void abortAbandoned(Long roomId) {
        publishAndPush(writer.abortAbandoned(roomId), "room");
    }

    /* ── 조회 ─────────────────────────────────────────────── */

    @Transactional(readOnly = true)
    public GameRoomResponse view(Long userId, Long roomId) {
        GameRoom room = roomRepository.findById(roomId)
                .orElseThrow(() -> new BusinessException(GameErrorCode.ROOM_NOT_FOUND));

        List<GameParticipant> participants = participantRepository.findByRoomIdOrderBySeatNo(roomId);
        GameParticipant me = participants.stream()
                .filter(p -> p.getUserId().equals(userId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(GameErrorCode.NOT_PARTICIPANT));

        Map<Long, String> nicknames = nicknamesOf(participants);
        List<GameParticipantResponse> seats = participants.stream()
                .map(p -> new GameParticipantResponse(
                        p.getSeatNo(),
                        nicknames.getOrDefault(p.getUserId(), "알 수 없음"),
                        room.isHost(p.getUserId()),
                        p.getUserId().equals(userId),
                        p.isReady(),
                        p.getPieceStyle(),
                        p.getStatus(),
                        p.getRank(),
                        p.getPayout()))
                .toList();

        long pool = room.getPrizePool() > 0 ? room.getPrizePool() : expectedPool(room, participants);
        long grant = room.getSubsidy() > 0 ? room.getSubsidy() : expectedSubsidy(room, participants);

        return new GameRoomResponse(
                room.getId(), room.getInviteCode(), room.getGameType(), room.getStatus(),
                room.getBetAmount(), room.getMaxPlayers(), room.getPiecesPerPlayer(),
                me.getSeatNo(), room.isHost(userId),
                seats, redact(room), room.getTurnExpiresAt(), pool, grant);
    }

    /** 지금 내가 들어가 있는 방. 앱을 다시 켰을 때 돌아갈 곳을 알려준다 */
    @Transactional(readOnly = true)
    public Optional<GameRoomResponse> myCurrentRoom(Long userId) {
        return participantRepository.findCurrentRoomOf(userId)
                .map(p -> view(userId, p.getRoomId()));
    }

    public SseEmitter subscribe(Long userId, Long roomId) {
        // 남의 방을 엿볼 수 없게 참가자인지 먼저 본다. 할리갈리는 카드를 뒤집는 순간이
        // 곧 정보라서, 구독만으로도 판을 들여다볼 수 있으면 안 된다
        participantRepository.findByRoomIdAndUserId(roomId, userId)
                .orElseThrow(() -> new BusinessException(GameErrorCode.NOT_PARTICIPANT));
        return broker.subscribe(roomId);
    }

    @Transactional(readOnly = true)
    public GamePolicyResponse policy(Long userId) {
        return new GamePolicyResponse(
                policy.betChoices(),
                policy.subsidyPerPlayer(),
                settlement.remainingSubsidyToday(userId),
                policy.prizeShares());
    }

    /* ── 도우미 ───────────────────────────────────────────── */

    private GameRoomResponse after(Long userId, GameRoomWriter.Outcome outcome, String event) {
        publishAndPush(outcome, event);
        return view(userId, outcome.roomId());
    }

    private void publishAndPush(GameRoomWriter.Outcome outcome, String event) {
        // 순서가 중요하다. 체인부터 밀고 알려야 "끝났다" 를 본 화면이 잔액을 다시 물었을 때
        // 이미 반영돼 있다.
        //
        // 🔴 여기서 터져도 요청을 실패시키지 않는다. 등수와 받을 금액은 이미 커밋됐고,
        //    남은 것은 체인 반영뿐이라 스위퍼가 같은 operationKey 로 다시 민다. 그런데
        //    500 을 내보내면 <b>이긴 사람이 마지막 수를 두는 순간 에러 화면을 본다.</b>
        //    실패는 pushToChain 이 ERROR 로 남기므로 조용히 묻히지도 않는다.
        for (Long participantId : outcome.chainPushIds()) {
            try {
                settlement.pushToChain(participantId);
            } catch (RuntimeException e) {
                log.error("정산을 체인에 미는 중 실패했습니다. 스위퍼가 다시 시도합니다. participantId={}",
                        participantId, e);
            }
        }
        broker.publish(outcome.roomId(), outcome.finished() ? "finished" : event);
    }

    /**
     * 화면에 내려보낼 게임판.
     *
     * <p>🔴 할리갈리의 {@code hands} (엎어 둔 카드)는 <b>지운다.</b> 본인 것이라도 알려주면
     * 다음에 뒤집힐 카드를 알고 종을 칠 수 있다. 장수만 남긴다.
     */
    private Map<String, Object> redact(GameRoom room) {
        if (room.getState() == null) {
            return null;
        }
        Map<String, Object> copy = new HashMap<>(room.getState());
        if (room.getGameType() != GameType.HALLI_GALLI) {
            return copy;
        }
        Object hands = copy.remove("hands");
        List<Integer> counts = new ArrayList<>();
        if (hands instanceof List<?> list) {
            list.forEach(hand -> counts.add(hand instanceof List<?> cards ? cards.size() : 0));
        }
        copy.put("handCounts", counts);
        return copy;
    }

    /** 아직 안 끝난 판에서 "지금 걸려 있는 돈" 을 보여주기 위한 어림값 */
    private long expectedPool(GameRoom room, List<GameParticipant> participants) {
        return room.getBetAmount() * participants.size() + expectedSubsidy(room, participants);
    }

    private long expectedSubsidy(GameRoom room, List<GameParticipant> participants) {
        if (room.isPractice() || participants.size() < 2) {
            return 0;
        }
        return policy.subsidyPerPlayer() * participants.size();
    }

    private Map<Long, String> nicknamesOf(List<GameParticipant> participants) {
        List<Long> ids = participants.stream().map(GameParticipant::getUserId).toList();
        Map<Long, String> nicknames = new HashMap<>();
        userRepository.findAllById(ids).forEach(user -> nicknames.put(user.getId(), nicknameOf(user)));
        return nicknames;
    }

    private String nicknameOf(User user) {
        return user.getNickname() == null ? "알 수 없음" : user.getNickname();
    }
}
