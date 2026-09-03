package com.teacat.server.wallet.repository;

import com.teacat.server.wallet.entity.WalletSeedGrant;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WalletSeedGrantRepository extends JpaRepository<WalletSeedGrant, Long> {
}
