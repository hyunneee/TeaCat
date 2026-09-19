package com.teacat.server.wallet.repository;

import com.teacat.server.wallet.entity.WalletProvision;
import com.teacat.server.wallet.entity.WalletProvisionStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface WalletProvisionRepository extends JpaRepository<WalletProvision, Long> {

    Optional<WalletProvision> findByUserId(Long userId);

    /**
     * 행을 잠그고 읽는다.
     *
     * <p>같은 메시지를 두 소비자가 동시에 집어도(블루그린 전환 중 두 색이 겹친다) 한쪽이 끝날 때까지
     * 다른 쪽이 기다리고, 기다린 쪽은 DONE 을 보고 물러난다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from WalletProvision p where p.id = :id")
    Optional<WalletProvision> findByIdForUpdate(@Param("id") Long id);

    /** 스위퍼용. 마지막으로 건드린 뒤 {@code before} 이전인 PENDING 행 */
    @Query("""
            select p.id from WalletProvision p
            where p.status = :status and p.updatedAt < :before
            order by p.id asc
            """)
    List<Long> findIdsByStatusAndUpdatedAtBefore(
            @Param("status") WalletProvisionStatus status,
            @Param("before") LocalDateTime before,
            Limit limit);
}
