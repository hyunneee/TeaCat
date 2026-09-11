package com.teacat.server.banner.repository;

import com.teacat.server.banner.entity.MainBanner;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

/**
 * 배너는 몇 개뿐이라 페이징하지 않는다.
 *
 * 공연 배너는 포스터·제목을 보려고 공연을 함께 읽어야 해서 {@link EntityGraph} 를 건다.
 * 안 그러면 배너 수만큼 공연을 한 번씩 더 읽는다.
 */
public interface MainBannerRepository extends JpaRepository<MainBanner, Long> {

    /** 홈에 뿌릴 것 — 켜져 있는 것만 순서대로 */
    @EntityGraph(attributePaths = "performance")
    List<MainBanner> findByActiveTrueOrderBySortOrderAscIdAsc();

    /** 관리 화면 — 꺼져 있는 것까지 전부 */
    @EntityGraph(attributePaths = "performance")
    List<MainBanner> findAllByOrderBySortOrderAscIdAsc();

    @Query("SELECT COALESCE(MAX(b.sortOrder), -1) FROM MainBanner b")
    int findMaxSortOrder();
}
