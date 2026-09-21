package com.teacat.server.reward.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 하루 한 번 보상을 받았다는 기록 한 줄.
 *
 * <p><b>이 행이 곧 "오늘은 받았다" 다.</b> 잔액은 체인이 들고 있고 서버는 저장하지 않으므로
 * (`CatMoneyService` 주석), 하루 한 번인지를 판단할 근거가 따로 필요하다.
 *
 * <p>🔴 <b>발행보다 이 행이 먼저 생긴다.</b> 발행(약 10초)이 끝나기를 기다렸다가 기록하면 그
 * 사이에 두 번째 요청이 들어와 두 번 지급된다. 그래서 행을 먼저 심어 그날을 선점하고,
 * 발행 요청이 실패하면 지운다 — 사용자는 다시 누를 수 있다.
 */
@Entity
@Table(name = "daily_rewards")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DailyReward {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "reward_type", nullable = false, updatable = false, columnDefinition = "daily_reward_type")
    private RewardType rewardType;

    @Column(name = "reward_date", nullable = false, updatable = false)
    private LocalDate rewardDate;

    /** 지급한 금액. 나중에 금액을 바꿔도 예전 지급액이 남아야 해서 베껴 둔다 */
    @Column(name = "amount", nullable = false, updatable = false)
    private Long amount;

    /** 어떤 발행으로 나갔는지. 발행 요청 전에 행이 먼저 생기므로 잠깐 비어 있다 */
    @Column(name = "cat_transaction_id")
    private Long catTransactionId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private DailyReward(Long userId, RewardType rewardType, LocalDate rewardDate) {
        this.userId = userId;
        this.rewardType = rewardType;
        this.rewardDate = rewardDate;
        this.amount = rewardType.amount();
    }

    public static DailyReward claim(Long userId, RewardType rewardType, LocalDate rewardDate) {
        return new DailyReward(userId, rewardType, rewardDate);
    }

    public void linkTransaction(Long catTransactionId) {
        this.catTransactionId = catTransactionId;
    }
}
