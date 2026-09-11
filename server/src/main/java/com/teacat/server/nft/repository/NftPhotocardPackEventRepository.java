package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftPhotocardPackEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface NftPhotocardPackEventRepository extends JpaRepository<NftPhotocardPackEvent, Long> {

    boolean existsByCode(String code);

    /**
     * 지금 진행 중인 이벤트 한 건.
     *
     * <p>둘 이상 열려 있으면 <b>가장 최근에 시작한 것</b> 하나다. 운영 실수로 겹쳐도
     * 동작이 결정적이어야 한다.
     *
     * <p>시작 시각이 비어 있는(즉시 시작) 이벤트는 <b>만든 시각을 시작으로 본다</b>
     * ({@code COALESCE(starts_at, created_at)}). 그냥 뒤로 밀면, 예전에 시작해 아직 켜져 있는
     * 이벤트가 <b>방금 연 상시 이벤트를 이겨</b> 운영자가 의도하지 않은 쪽이 지급된다.
     *
     * <p>시간 기준은 DB 의 {@code now()} 다 — 애플리케이션 시계와 섞지 않는다.
     */
    @Query(value = """
            SELECT * FROM nft_photocard_pack_events
             WHERE active
               AND (starts_at IS NULL OR starts_at <= now())
               AND (ends_at   IS NULL OR ends_at   >  now())
             ORDER BY COALESCE(starts_at, created_at) DESC, id DESC
             LIMIT 1
            """, nativeQuery = true)
    Optional<NftPhotocardPackEvent> findOngoing();

    /** 어드민 목록. 최신순 */
    List<NftPhotocardPackEvent> findAllByOrderByIdDesc();
}
