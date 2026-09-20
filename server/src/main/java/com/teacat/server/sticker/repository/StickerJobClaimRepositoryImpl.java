package com.teacat.server.sticker.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * {@link StickerJobClaimRepository} 구현. 이름이 {@code …Impl} 이어야 Spring Data 가 찾아 끼운다.
 */
@Repository
class StickerJobClaimRepositoryImpl implements StickerJobClaimRepository {

    /**
     * 가장 오래 기다린 PENDING 을 집어 RUNNING 으로 바꾸고 id 를 돌려준다.
     *
     * <p>{@code UPDATE … RETURNING} 이라 갱신이면서 결과 집합을 낸다. 고르기(SELECT)와
     * 표시(UPDATE)가 한 문장이므로 두 워커가 같은 행을 집는 틈이 없다.
     */
    private static final String CLAIM_NEXT = """
            UPDATE sticker_jobs
               SET status = 'RUNNING', claimed_at = now(), worker_id = :workerId
             WHERE id = (SELECT id FROM sticker_jobs
                          WHERE status = 'PENDING'
                          ORDER BY created_at
                            FOR UPDATE SKIP LOCKED
                          LIMIT 1)
            RETURNING id
            """;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public Optional<Long> claimNext(String workerId) {
        // 쌓인 변경을 먼저 내보낸다. 네이티브 문장은 영속성 컨텍스트를 모르므로
        // 여기서 밀지 않으면 DB 가 옛 상태를 보고 고른다.
        entityManager.flush();

        List<?> ids = entityManager.createNativeQuery(CLAIM_NEXT)
                .setParameter("workerId", workerId)
                .getResultList();

        /* 🔴 네이티브 UPDATE 는 1차 캐시를 우회한다. 비우지 않으면 바로 뒤의 findById 가
           캐시에 남은 PENDING 을 돌려주고, 그 상태로 검사하면 STICKER_008 이 난다.
           집는 트랜잭션에는 다른 엔티티가 없어 통째로 비워도 잃을 것이 없다. */
        entityManager.clear();

        return ids.stream()
                .findFirst()
                .map(id -> ((Number) id).longValue());
    }
}
