package com.teacat.server.wallet.repository;

import com.teacat.server.wallet.entity.CatTransaction;
import com.teacat.server.wallet.entity.CatTxDirection;
import com.teacat.server.wallet.entity.CatTxStatus;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigInteger;
import java.util.List;
import java.util.Optional;

public interface CatTransactionRepository extends JpaRepository<CatTransaction, Long> {

    Optional<CatTransaction> findByOperationKey(String operationKey);

    /** 확정 폴링 대상. 오래된 것부터 본다 */
    List<CatTransaction> findByStatusOrderByIdAsc(CatTxStatus status, Limit limit);

    /**
     * 방향·상태별 합계.
     *
     * <p>enum 을 <b>파라미터로 넘긴다.</b> JPQL 에 {@code CatTxDirection.BURN} 처럼 리터럴로 쓰면
     * Hibernate 가 자바 클래스명으로 캐스팅을 만들어({@code 'BURN'::CatTxDirection}) Postgres 의
     * 실제 타입명({@code cat_tx_direction})과 어긋나 실행 시점에 깨진다.
     */
    @Query("""
            SELECT COALESCE(SUM(t.amount), 0)
            FROM CatTransaction t
            WHERE t.user.id = :userId
              AND t.direction = :direction
              AND t.status = :status
            """)
    BigInteger sumByDirectionAndStatus(@Param("userId") Long userId,
            @Param("direction") CatTxDirection direction,
            @Param("status") CatTxStatus status);

    /**
     * 아직 확정되지 않은 소각 합계.
     *
     * <p>체인 잔액에는 아직 반영되지 않았지만 <b>이미 나간 돈</b>이다. 가용액에서 빼지 않으면
     * 같은 잔액을 두 번 쓸 수 있다. 없으면 0 을 돌려준다.
     */
    default BigInteger sumPendingBurns(Long userId) {
        return sumByDirectionAndStatus(userId, CatTxDirection.BURN, CatTxStatus.PENDING);
    }

}
