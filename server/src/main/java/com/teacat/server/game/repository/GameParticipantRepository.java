package com.teacat.server.game.repository;

import com.teacat.server.game.entity.GameParticipant;
import com.teacat.server.game.entity.GameParticipantStatus;
import com.teacat.server.game.entity.GameRoomStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/** enum 리터럴을 JPQL 에 적지 않는 이유는 {@link GameRoomRepository} 주석과 같다 */
public interface GameParticipantRepository extends JpaRepository<GameParticipant, Long> {

    List<GameParticipant> findByRoomIdOrderBySeatNo(Long roomId);

    Optional<GameParticipant> findByRoomIdAndUserId(Long roomId, Long userId);

    @Query("""
            select p from GameParticipant p
             where p.roomId = :roomId
               and p.status in :statuses
             order by p.seatNo
            """)
    List<GameParticipant> findByRoomIdAndStatusIn(@Param("roomId") Long roomId,
            @Param("statuses") List<GameParticipantStatus> statuses);

    /** 아직 판에 남아 있는 사람들 */
    default List<GameParticipant> findAliveInRoom(Long roomId) {
        return findByRoomIdAndStatusIn(roomId,
                List.of(GameParticipantStatus.JOINED, GameParticipantStatus.PLAYING));
    }

    /**
     * 이 사람이 지금 들어가 있는 방.
     *
     * <p>한 번에 한 방만 허용한다. 두 방에 판돈이 묶이면 가용 잔액이 음수로 보일 수 있고,
     * 어느 쪽 게임도 제대로 진행할 수 없다.
     */
    @Query("""
            select p from GameParticipant p
              join GameRoom r on r.id = p.roomId
             where p.userId = :userId
               and r.status in :roomStatuses
               and p.status in :participantStatuses
            """)
    List<GameParticipant> findActiveOf(@Param("userId") Long userId,
            @Param("roomStatuses") List<GameRoomStatus> roomStatuses,
            @Param("participantStatuses") List<GameParticipantStatus> participantStatuses);

    default Optional<GameParticipant> findCurrentRoomOf(Long userId) {
        return findActiveOf(userId,
                List.of(GameRoomStatus.WAITING, GameRoomStatus.PLAYING),
                List.of(GameParticipantStatus.JOINED, GameParticipantStatus.PLAYING))
                .stream()
                .findFirst();
    }

    /**
     * 오늘 이 사람에게 나간 보조금 합계.
     *
     * <p>🔴 이 값이 없으면 보조금이 무한 수급기가 된다 — 계정 둘로 판을 계속 돌리면
     * 판마다 인원수 × 정액이 그냥 생긴다.
     */
    @Query("""
            select coalesce(sum(p.subsidyShare), 0) from GameParticipant p
             where p.userId = :userId
               and p.settledAt >= :from
               and p.settledAt < :to
            """)
    long sumSubsidyBetween(@Param("userId") Long userId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    @Query("select coalesce(max(p.seatNo), -1) from GameParticipant p where p.roomId = :roomId")
    int maxSeatNo(@Param("roomId") Long roomId);

    /**
     * 장부에는 적혔는데 체인에 아직 못 민 정산.
     *
     * <p>체인이 잠깐 죽어 있으면 여기 쌓인다. 판돈 홀드가 풀리지 않은 상태라 사용자는
     * 그만큼을 못 쓴다 — 밀린 것을 빨리 알아채야 한다.
     */
    @Query("""
            select p from GameParticipant p
             where p.settledAt is not null
               and p.chainSettledAt is null
             order by p.settledAt
            """)
    List<GameParticipant> findPendingChainSettlements();
}
