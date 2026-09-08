package com.teacat.server.wallet.repository;

import com.teacat.server.wallet.entity.CatMoneyHold;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import com.teacat.server.wallet.entity.CatMoneyHoldStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CatMoneyHoldRepository extends JpaRepository<CatMoneyHold, Long> {

    Optional<CatMoneyHold> findByRefTypeAndRefId(CatMoneyHoldRefType refType, Long refId);

    /** 유저의 유효 홀드 합. 없으면 0 */
    @Query("""
            select coalesce(sum(h.amount), 0)
              from CatMoneyHold h
             where h.userId = :userId
               and h.status = :status
            """)
    long sumAmountByUserIdAndStatus(@Param("userId") Long userId, @Param("status") CatMoneyHoldStatus status);

    default long sumActiveAmount(Long userId) {
        return sumAmountByUserIdAndStatus(userId, CatMoneyHoldStatus.ACTIVE);
    }
}
