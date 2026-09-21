package com.teacat.server.reward.repository;

import com.teacat.server.reward.entity.DailyReward;
import com.teacat.server.reward.entity.RewardType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyRewardRepository extends JpaRepository<DailyReward, Long> {

    Optional<DailyReward> findByUserIdAndRewardTypeAndRewardDate(Long userId, RewardType rewardType,
                                                                 LocalDate rewardDate);

    /** 오늘 받은 것 전부. 종류가 둘뿐이라 한 번에 읽고 화면이 나눠 쓴다 */
    List<DailyReward> findByUserIdAndRewardDate(Long userId, LocalDate rewardDate);
}
