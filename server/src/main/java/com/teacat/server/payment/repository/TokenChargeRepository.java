package com.teacat.server.payment.repository;

import com.teacat.server.payment.entity.TokenCharge;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TokenChargeRepository extends JpaRepository<TokenCharge, Long> {

    Optional<TokenCharge> findByPaymentId(Long paymentId);

    /**
     * 승인은 됐는데 발행을 못 보낸 건.
     *
     * <p>발행 요청이 실패했거나 그 사이에 서버가 죽은 경우다. 체인 멱등 키가 있어 다시 보내도
     * 두 번 발행되지 않는다.
     */
    List<TokenCharge> findByMintTxIsNullOrderByIdAsc(Limit limit);
}
