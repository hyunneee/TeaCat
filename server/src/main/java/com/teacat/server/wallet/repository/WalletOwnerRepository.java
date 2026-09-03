package com.teacat.server.wallet.repository;

import com.teacat.server.wallet.entity.WalletOwner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface WalletOwnerRepository extends JpaRepository<WalletOwner, Long> {

    Optional<WalletOwner> findByUserId(Long userId);

    /**
     * 다음 파생 인덱스를 시퀀스에서 뽑는다.
     *
     * 시퀀스 값은 트랜잭션이 롤백돼도 되돌아가지 않는다. 그래서 가입이 실패해도
     * 그 인덱스는 버려질 뿐 <b>다른 사람에게 다시 배정되지 않는다.</b>
     * (MAX + 1 로 뽑으면 롤백 시 재사용되어 남의 자산이 딸려 온다)
     */
    @Query(value = "SELECT nextval('wallet_derivation_index_seq')", nativeQuery = true)
    long nextDerivationIndex();
}
