package com.teacat.server.reward.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.reward.dto.response.AttendanceCalendarResponse;
import com.teacat.server.reward.dto.response.DailyRewardStatusResponse;
import com.teacat.server.reward.dto.response.RewardClaimResponse;
import com.teacat.server.reward.dto.response.RewardStateResponse;
import com.teacat.server.reward.entity.DailyReward;
import com.teacat.server.reward.entity.RewardType;
import com.teacat.server.reward.exception.RewardErrorCode;
import com.teacat.server.reward.repository.DailyRewardRepository;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import com.teacat.server.wallet.entity.CatTransaction;
import com.teacat.server.wallet.entity.CatTxReason;
import com.teacat.server.wallet.service.CatMoneyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.math.BigInteger;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * 하루 한 번 받는 캣머니 보상 — 출석 체크와 송편 잡기.
 *
 * <p><b>금액도 하루 한 번도 서버가 정한다.</b> 요청 본문에 금액 자리가 없고
 * ({@link RewardType#amount()}), "오늘 받았는지" 는 {@code daily_rewards} 의 UNIQUE 인덱스가
 * 판단한다. 화면이 보낸 값을 믿으면 콘솔에서 금액을 바꿀 수 있다 (client/CLAUDE.md 7장).
 *
 * <p>⚠️ <b>송편 잡기의 클리어 판정은 브라우저가 한다.</b> 서버는 단계를 세지 않으므로 실제로
 * 5단계를 깼는지는 검증되지 않는다 — 콘솔을 열 줄 아는 사람은 클리어 없이 부를 수 있다.
 * 이벤트 보상이고 하루 상한이 걸려 있어 지금은 감수한다. 막으려면 단계 시작·성공을 서버가
 * 받아 세야 한다 ({@link RewardType#SONGPYEON} 주석).
 *
 * <p>🔴 <b>트랜잭션을 걸지 않는다.</b> 발행({@link CatMoneyService#mint})이 체인에 다녀오는
 * 동안(최대 20초) DB 커넥션을 잡고 있으면 풀이 마른다. 저장은 리포지토리가 각자 짧은
 * 트랜잭션으로 처리한다 — {@code CatMoneyService} 와 같은 규율이다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RewardService {

    private final DailyRewardRepository dailyRewardRepository;
    private final UserRepository userRepository;
    private final CatMoneyService catMoneyService;

    /**
     * 오늘 무엇을 받았는지.
     *
     * <p>아직 안 받은 종류도 {@code claimed=false} 로 내려준다. 받은 것만 내려주면 화면이
     * "없는 것 = 안 받음" 을 스스로 추론해야 하고, 종류가 늘 때 조용히 빠진다.
     */
    public DailyRewardStatusResponse status(Long userId) {
        LocalDate today = today();
        Map<RewardType, DailyReward> claimed = new EnumMap<>(RewardType.class);
        for (DailyReward row : dailyRewardRepository.findByUserIdAndRewardDate(userId, today)) {
            claimed.put(row.getRewardType(), row);
        }

        /* 누를 수 있는 것만 내려보낸다. 짝 맞추기 1등 보상(MEMORY_RANK)은 스케줄러가 넣는 것이라
           목록에 띄우면 "눌러도 안 받아지는 줄" 이 된다 (RewardType.MEMORY_RANK 주석) */
        List<RewardStateResponse> rewards = Arrays.stream(RewardType.values())
                .filter(RewardType::claimable)
                .map(type -> RewardStateResponse.of(type, claimed.get(type)))
                .toList();

        return new DailyRewardStatusResponse(
                today,
                dailyRewardRepository.countStreakUntil(userId, today),
                rewards);
    }

    /**
     * 오늘 몫을 받는다.
     *
     * <p>🔴 <b>발행보다 기록이 먼저다.</b> 발행이 끝나기를 기다렸다가 기록하면 그 10초 사이에
     * 두 번째 요청이 "아직 안 받았다" 를 읽고 또 발행한다. 그래서 행을 먼저 심어 오늘을
     * 선점하고, 발행 요청이 실패하면 그 행을 지운다 — 사용자는 다시 누를 수 있다.
     *
     * <p>지급 자체는 {@code reward:<종류>:<회원>:<날짜>} 를 멱등 키로 쓴다. 키가 날짜까지
     * 고정이라 같은 날 같은 요청이 여러 번 들어와도 체인은 한 번만 발행한다 — 행을 지우고
     * 재시도하는 위 경로가 두 번 지급으로 이어지지 않는 마지막 방어선이다.
     */
    public RewardClaimResponse claim(Long userId, RewardType type) {
        if (!type.claimable()) {
            // 컨트롤러가 타입을 고정해 부르므로 여기까지 올 일은 없다. 경로가 생기면 여기서 막힌다
            throw new BusinessException(RewardErrorCode.NOT_CLAIMABLE);
        }
        if (!userRepository.existsById(userId)) {
            throw new BusinessException(UserErrorCode.USER_NOT_FOUND);
        }

        LocalDate today = today();
        DailyReward claim = occupyToday(userId, type, today);

        CatTransaction transaction;
        try {
            transaction = catMoneyService.mint(
                    userId,
                    BigInteger.valueOf(type.amount()),
                    CatTxReason.REWARD,
                    operationKey(userId, type, today));
        } catch (RuntimeException e) {
            /* 발행을 못 보냈는데 "오늘 받음" 으로 남으면 하루를 통째로 잃는다.
               선점을 물리고 그대로 올려 보낸다 — 화면은 다시 누를 수 있다. */
            dailyRewardRepository.delete(claim);
            log.warn("보상 발행에 실패해 오늘 기록을 되돌렸습니다. userId={} type={}", userId, type, e);
            throw e;
        }

        claim.linkTransaction(transaction.getId());
        dailyRewardRepository.save(claim);

        log.info("캣머니 보상을 지급했습니다. userId={} type={} amount={} status={}",
                userId, type, type.amount(), transaction.getStatus());

        return RewardClaimResponse.of(type, today, transaction);
    }

    /**
     * 오늘 몫을 선점한다. 이미 있으면 409.
     *
     * <p>먼저 조회해서 막고, 그래도 뚫리면 UNIQUE 인덱스가 막는다. 조회만으로는 부족하다 —
     * 버튼을 빠르게 두 번 누르면 두 요청이 나란히 "없다" 를 읽는다.
     */
    private DailyReward occupyToday(Long userId, RewardType type, LocalDate today) {
        if (dailyRewardRepository.findByUserIdAndRewardTypeAndRewardDate(userId, type, today).isPresent()) {
            throw new BusinessException(RewardErrorCode.ALREADY_CLAIMED);
        }

        try {
            return dailyRewardRepository.saveAndFlush(DailyReward.claim(userId, type, today));
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException(RewardErrorCode.ALREADY_CLAIMED);
        }
    }

    /**
     * 날이 바뀌는 기준.
     *
     * <p>앱 컨테이너가 {@code TZ=Asia/Seoul} 이라 {@code LocalDate.now()} 가 한국 날짜다
     * (DB 도 같은 전제로 쓰고 있다 — {@code NftChainPipelineMetrics} 주석). 여기서 시간대를
     * 따로 지정하지 않는 것은 그 전제를 한 곳에만 두기 위해서다.
     */
    private LocalDate today() {
        return LocalDate.now();
    }

    /**
     * 한 달치 출석 기록.
     *
     * <p>🔴 <b>연속 출석 일수를 화면에서 세지 않는다.</b> 이 응답은 한 달만 담고 있어서
     * 월초에 보면 지난달에 이어온 것이 안 보이고, 날짜 계산을 기기 시계로 하면 자정
     * 근처에서 사람마다 다르게 나온다. 서버가 전체 기록으로 한 번 세서 내려준다.
     *
     * @param month 조회할 달의 아무 날. 없으면 이번 달
     */
    public AttendanceCalendarResponse attendanceCalendar(Long userId, LocalDate month) {
        LocalDate today = today();
        LocalDate firstDay = (month == null ? today : month).withDayOfMonth(1);

        List<AttendanceCalendarResponse.AttendanceDayResponse> days =
                dailyRewardRepository.findMonth(userId, RewardType.ATTENDANCE, firstDay).stream()
                        .map(row -> new AttendanceCalendarResponse.AttendanceDayResponse(
                                row.getRewardDate(), row.getAmount()))
                        .toList();

        long totalAmount = days.stream()
                .mapToLong(AttendanceCalendarResponse.AttendanceDayResponse::amount)
                .sum();

        return new AttendanceCalendarResponse(
                firstDay,
                days,
                days.size(),
                totalAmount,
                dailyRewardRepository.countStreakUntil(userId, today),
                today);
    }

    /** 멱등 키. 비밀값을 넣지 않는다 — 해시가 체인에 영구히 남는다 */
    private String operationKey(Long userId, RewardType type, LocalDate date) {
        return "reward:%s:%d:%s".formatted(type.name().toLowerCase(), userId, date);
    }
}
