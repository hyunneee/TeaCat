package com.teacat.server.analytics.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 하루 접속 기록. (회원, 날짜) 하나당 한 행이다.
 *
 * <p>쓰기는 {@code DailyActiveUserRepository.recordVisit} 의 네이티브 INSERT 로만 한다
 * (ON CONFLICT DO NOTHING 이 필요해서다). 이 엔티티는 스키마 검증과 조회를 위해 둔다.
 *
 * <p>회원을 {@code @ManyToOne} 으로 잡지 않는다. 통계 쿼리는 전부 집계라 회원 객체를
 * 꺼낼 일이 없고, JPQL 로 조인하면 {@code User} 에 걸린
 * {@code @SQLRestriction("deleted_at is null")} 이 따라붙어 탈퇴 회원의 과거 접속이
 * 사라진다 — 지난 접속자 수가 오늘 누가 탈퇴했다고 줄어들면 안 된다.
 * 그래서 집계는 네이티브 쿼리로 {@code users} 테이블을 직접 조인한다.
 */
@Entity
@Table(name = "daily_active_users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DailyActiveUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "visit_date", nullable = false)
    private LocalDate visitDate;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
