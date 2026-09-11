package com.teacat.server.auth.entity;

import com.teacat.server.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * 회원과 외부 계정(SSAFY)의 연결.
 *
 * 연결의 기준은 제공자가 주는 고유 식별자다. 이메일은 바뀔 수 있어서 기준이 될 수 없다.
 */
@Entity
@Table(name = "user_oauth_accounts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OauthAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "provider", nullable = false, columnDefinition = "oauth_provider")
    private OauthProvider provider;

    @Column(name = "provider_user_id", nullable = false, length = 100)
    private String providerUserId;

    /** 연결 시점의 제공자 이메일. 기록용이며 조회 기준으로 쓰지 않는다 */
    @Column(name = "email")
    private String email;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private OauthAccount(User user, OauthProvider provider, String providerUserId, String email) {
        this.user = user;
        this.provider = provider;
        this.providerUserId = providerUserId;
        this.email = email;
    }

    public static OauthAccount link(User user, OauthProvider provider, String providerUserId, String email) {
        return new OauthAccount(user, provider, providerUserId, email);
    }

    /**
     * 같은 회원·같은 제공자의 연결을 새 식별자로 갈아끼운다.
     *
     * 회원당 제공자 하나만 연결할 수 있으므로(uq_user_oauth_accounts_user_provider)
     * 제공자 쪽 식별자가 바뀌었을 때 새 행을 넣는 대신 기존 행을 고친다.
     */
    public void relink(String providerUserId, String email) {
        this.providerUserId = providerUserId;
        this.email = email;
    }
}
