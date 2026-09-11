package com.teacat.server.auth.repository;

import com.teacat.server.auth.entity.OauthAccount;
import com.teacat.server.auth.entity.OauthProvider;
import com.teacat.server.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OauthAccountRepository extends JpaRepository<OauthAccount, Long> {

    Optional<OauthAccount> findByProviderAndProviderUserId(OauthProvider provider, String providerUserId);

    /**
     * 회원당 제공자 하나만 연결할 수 있다(uq_user_oauth_accounts_user_provider).
     * 새로 연결하기 전에 이미 있는지 확인해서 중복 INSERT 를 막는다.
     */
    Optional<OauthAccount> findByUserAndProvider(User user, OauthProvider provider);
}
