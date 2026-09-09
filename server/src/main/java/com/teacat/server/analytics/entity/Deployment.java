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

import java.time.LocalDateTime;

/**
 * 배포 한 번. 차트에 세로 마커선으로 얹힌다.
 *
 * <p>젠킨스가 운영(master) 배포에 성공한 직후 넣는다. 같은 커밋을 다시 배포하면
 * {@code (environment, commit_hash)} 유니크 제약에 걸려 무시된다 — 마커는 하나면 된다.
 */
@Entity
@Table(name = "deployments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Deployment {

    public static final int ENVIRONMENT_MAX_LENGTH = 10;
    public static final int BRANCH_MAX_LENGTH = 100;
    public static final int COMMIT_HASH_MAX_LENGTH = 40;
    public static final int SUMMARY_MAX_LENGTH = 200;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "environment", nullable = false, length = ENVIRONMENT_MAX_LENGTH)
    private String environment;

    @Column(name = "branch", nullable = false, length = BRANCH_MAX_LENGTH)
    private String branch;

    @Column(name = "commit_hash", nullable = false, length = COMMIT_HASH_MAX_LENGTH)
    private String commitHash;

    /** 커밋 제목 한 줄. 없을 수도 있다 (젠킨스가 못 읽은 경우) */
    @Column(name = "summary", length = SUMMARY_MAX_LENGTH)
    private String summary;

    @Column(name = "build_number")
    private Integer buildNumber;

    @Column(name = "deployed_at", nullable = false)
    private LocalDateTime deployedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
