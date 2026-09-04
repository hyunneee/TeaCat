package com.teacat.server.wallet.repository;

import com.teacat.server.wallet.entity.CatTransaction;
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
     * 아직 확정되지 않은 소각 합계.
     *
     * <p>체인 잔액에는 아직 반영되지 않았지만 <b>이미 나간 돈</b>이다. 가용액에서 빼지 않으면
     * 같은 잔액을 두 번 쓸 수 있다. 없으면 0 을 돌려준다.
     */
    @Query("""
            SELECT COALESCE(SUM(t.amount), 0)
            FROM CatTransaction t
            WHERE t.user.id = :userId
              AND t.direction = com.teacat.server.wallet.entity.CatTxDirection.BURN
              AND t.status = com.teacat.server.wallet.entity.CatTxStatus.PENDING
            """)
    BigInteger sumPendingBurns(@Param("userId") Long userId);
}
