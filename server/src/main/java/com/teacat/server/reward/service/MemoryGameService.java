package com.teacat.server.reward.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.reward.dto.response.MemoryGameResultResponse;
import com.teacat.server.reward.dto.response.MemoryGameStartResponse;
import com.teacat.server.reward.dto.response.MemoryRankEntryResponse;
import com.teacat.server.reward.dto.response.MemoryRankingResponse;
import com.teacat.server.reward.entity.MemoryGameSession;
import com.teacat.server.reward.entity.RewardType;
import com.teacat.server.reward.exception.RewardErrorCode;
import com.teacat.server.reward.repository.MemoryGameSessionRepository;
import com.teacat.server.reward.repository.MemoryGameSessionRepository.MemoryRankRow;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 포토카드 짝 맞추기 — 판 기록과 하루 랭킹.
 *
 * <p>순위는 <b>걸린 시간이 짧은 순</b>이고, 사람마다 그날 가장 빠른 판 하나만 오른다.
 * 1등에게는 다음날 {@link MemoryRankRewardScheduler} 가 캣머니를 넣는다.
 *
 * <p>🔴 <b>시간을 화면에서 받지 않는다.</b> {@link #start}가 시작 시각을 박아 두고 {@link #clear}가
 * 서버 시각에서 뺀다. 이 서비스에 "몇 초 걸렸다" 를 인자로 받는 메서드는 없다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemoryGameService {

    /** 순위표에 보여줄 줄 수. 넘치면 스크롤만 길어지고 아무도 안 읽는다 */
    private static final int RANKING_SIZE = 10;

    private final MemoryGameSessionRepository sessionRepository;
    private final UserRepository userRepository;

    /** 판을 연다. 이 순간이 시작 시각이다 */
    @Transactional
    public MemoryGameStartResponse start(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new BusinessException(UserErrorCode.USER_NOT_FOUND);
        }
        MemoryGameSession session = sessionRepository.save(
                MemoryGameSession.start(userId, LocalDateTime.now()));
        return MemoryGameStartResponse.of(session);
    }

    /**
     * 클리어를 기록한다. 걸린 시간은 서버가 계산한다.
     *
     * <p>끝내지 않고 나간 판은 그냥 남는다 — 지우지 않는 이유는 엔티티 주석에 있다.
     */
    @Transactional
    public MemoryGameResultResponse clear(Long userId, Long sessionId, int moves) {
        MemoryGameSession session = sessionRepository.findById(sessionId)
                .filter(row -> row.isOwnedBy(userId))
                .orElseThrow(() -> new BusinessException(RewardErrorCode.GAME_SESSION_NOT_FOUND));
        if (session.isCleared()) {
            throw new BusinessException(RewardErrorCode.GAME_ALREADY_CLEARED);
        }

        session.clear(LocalDateTime.now(), moves);
        sessionRepository.flush();

        /* 방금 판이 오늘 내 최고인지 본다. 최고 기록의 세션 id 가 이 판이면 갱신한 것이다 —
           같은 시간이 나왔을 때는 먼저 세운 판이 이기므로(쿼리의 cleared_at 정렬) 최고가 아니다 */
        MemoryRankRow myRank = sessionRepository.findMyRank(session.getPlayedOn(), userId).orElse(null);
        boolean personalBest = myRank != null && myRank.getElapsedMs() == session.getElapsedMs();

        log.info("짝 맞추기 클리어 userId={} sessionId={} elapsedMs={} moves={} rank={}",
                userId, sessionId, session.getElapsedMs(), moves,
                myRank == null ? null : myRank.getRank());

        return MemoryGameResultResponse.of(session,
                myRank == null ? null : myRank.getRank(), personalBest);
    }

    /** 오늘 랭킹 + 내 등수 + 어제 1등 */
    public MemoryRankingResponse ranking(Long viewerId) {
        LocalDate today = LocalDate.now();

        List<MemoryRankEntryResponse> entries = sessionRepository.findRanking(today, RANKING_SIZE)
                .stream()
                .map(row -> MemoryRankEntryResponse.of(row, viewerId))
                .toList();

        /* 순위표 안에 이미 내가 있으면 또 내려보내지 않는다 — 화면이 같은 줄을 두 번 그리게 된다 */
        MemoryRankEntryResponse myRank = entries.stream().anyMatch(MemoryRankEntryResponse::me)
                ? null
                : sessionRepository.findMyRank(today, viewerId)
                        .map(row -> MemoryRankEntryResponse.of(row, viewerId))
                        .orElse(null);

        MemoryRankEntryResponse yesterdayWinner = sessionRepository.findWinner(today.minusDays(1))
                .map(row -> MemoryRankEntryResponse.of(row, viewerId))
                .orElse(null);

        return new MemoryRankingResponse(today, RewardType.MEMORY_RANK.amount(), entries, myRank,
                yesterdayWinner);
    }
}
