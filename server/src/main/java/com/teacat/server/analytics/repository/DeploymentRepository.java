package com.teacat.server.analytics.repository;

import com.teacat.server.analytics.entity.Deployment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public interface DeploymentRepository extends JpaRepository<Deployment, Long> {

    /**
     * 배포를 기록한다. 같은 환경에 같은 커밋이 이미 있으면 아무 일도 없다.
     *
     * <p>젠킨스는 재실행될 수 있다 (실패한 배포를 다시 돌리거나, 같은 커밋을 다시 올리거나).
     * 그때마다 마커가 하나씩 늘면 차트가 지저분해진다. 저장을 멱등하게 만들어
     * 젠킨스 쪽에서 "이미 보냈나" 를 판단하지 않아도 되게 한다.
     *
     * @return 실제로 들어간 행 수 (0 이면 이미 기록돼 있던 배포)
     */
    @Transactional
    @Modifying
    @Query(value = """
            INSERT INTO deployments (environment, branch, commit_hash, summary, build_number, deployed_at)
            VALUES (:environment, :branch, :commitHash, :summary, :buildNumber, :deployedAt)
            ON CONFLICT (environment, commit_hash) DO NOTHING
            """, nativeQuery = true)
    int record(@Param("environment") String environment,
               @Param("branch") String branch,
               @Param("commitHash") String commitHash,
               @Param("summary") String summary,
               @Param("buildNumber") Integer buildNumber,
               @Param("deployedAt") LocalDateTime deployedAt);

    /**
     * 차트 구간에 걸치는 배포들. 오래된 것부터.
     *
     * <p>{@code to} 는 그 날 하루를 포함해야 하므로 다음 날 0 시 직전까지 본다.
     */
    @Query(value = """
            SELECT * FROM deployments d
             WHERE d.deployed_at >= CAST(:from AS date)
               AND d.deployed_at < CAST(:to AS date) + INTERVAL '1 day'
             ORDER BY d.deployed_at
            """, nativeQuery = true)
    List<Deployment> findInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
