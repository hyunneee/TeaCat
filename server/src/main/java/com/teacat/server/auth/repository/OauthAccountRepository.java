package com.teacat.server.auth.repository;

import com.teacat.server.auth.entity.OauthAccount;
import com.teacat.server.auth.entity.OauthProvider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OauthAccountRepository extends JpaRepository<OauthAccount, Long> {

    Optional<OauthAccount> findByProviderAndProviderUserId(OauthProvider provider, String providerUserId);
}
