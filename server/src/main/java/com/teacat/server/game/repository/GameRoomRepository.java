package com.teacat.server.game.repository;

import com.teacat.server.game.entity.GameRoom;
import com.teacat.server.game.entity.GameRoomStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 🔴 <b>JPQL 안에 enum 리터럴을 쓰지 않는다.</b> 하이버네이트가 {@code 'PLAYING'::GameRoomStatus}
 * 처럼 <b>자바 타입 이름</b>으로 캐스트를 붙이는데, 실제 Postgres 타입 이름은
 * {@code game_room_status} 라 {@code type "gameroomstatus" does not exist} 로 터진다.
 * 전에 다른 도메인에서 스케줄러가 이것 때문에 죽어 dev 가 멈춘 적이 있다.
 * 상태는 전부 <b>파라미터</b>로 넘기고, 부르는 쪽 편의를 위해 default 메서드로 감싼다.
 */
public interface GameRoomRepository extends JpaRepository<GameRoom, Long> {

    @Query("select r from GameRoom r where r.inviteCode = :code and r.status = :status")
    Optional<GameRoom> findByInviteCodeAndStatus(@Param("code") String code,
            @Param("status") GameRoomStatus status);

    /** 초대 코드로 들어갈 수 있는 방. 시작·종료된 방은 코드로 찾히지 않는다 */
    default Optional<GameRoom> findOpenByInviteCode(String code) {
        return findByInviteCodeAndStatus(code, GameRoomStatus.WAITING);
    }

    @Query("select count(r) > 0 from GameRoom r where r.inviteCode = :code and r.status in :statuses")
    boolean existsByInviteCodeAndStatusIn(@Param("code") String code,
            @Param("statuses") List<GameRoomStatus> statuses);

    /** 코드는 살아 있는 방들 사이에서만 겹치지 않으면 된다 */
    default boolean isCodeTaken(String code) {
        return existsByInviteCodeAndStatusIn(code, List.of(GameRoomStatus.WAITING, GameRoomStatus.PLAYING));
    }

    /**
     * 방을 잠그고 읽는다.
     *
     * <p><b>게임판을 건드리는 모든 경로는 이것으로 시작한다.</b> 할리갈리의 종처럼 동시에
     * 들어오는 요청을 줄 세우는 곳이 여기다 — 두 번째 요청은 첫 번째가 커밋한 뒤의 판을 본다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from GameRoom r where r.id = :id")
    Optional<GameRoom> findByIdForUpdate(@Param("id") Long id);

    @Query("""
            select r from GameRoom r
             where r.status = :status
               and r.turnExpiresAt is not null
               and r.turnExpiresAt < :now
             order by r.turnExpiresAt
            """)
    List<GameRoom> findStalled(@Param("status") GameRoomStatus status, @Param("now") LocalDateTime now);

    /** 아무도 진행시키지 않아 멈춘 판 */
    default List<GameRoom> findStalledRooms(LocalDateTime now) {
        return findStalled(GameRoomStatus.PLAYING, now);
    }

    @Query("""
            select r from GameRoom r
             where r.status = :status
               and r.createdAt < :before
            """)
    List<GameRoom> findStaleWaiting(@Param("status") GameRoomStatus status,
            @Param("before") LocalDateTime before);

    /** 만들어 놓고 아무도 안 온 방 */
    default List<GameRoom> findAbandonedWaitingRooms(LocalDateTime before) {
        return findStaleWaiting(GameRoomStatus.WAITING, before);
    }
}
