package com.teacat.server.wallet.repository;

import com.teacat.server.wallet.entity.Wallet;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WalletRepository extends JpaRepository<Wallet, Long> {

    Optional<Wallet> findByOwnerIdAndChainId(Long ownerId, Integer chainId);
}
