package com.teacat.server.auth.security;

import com.teacat.server.user.entity.UserRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;

/**
 * 액세스 토큰 발급/검증.
 */
@Component
public class JwtTokenProvider {

    private static final String CLAIM_ROLE = "role";

    private final SecretKey secretKey;
    private final Duration accessTokenValidity;

    public JwtTokenProvider(JwtProperties jwtProperties) {
        this.secretKey = Keys.hmacShaKeyFor(jwtProperties.secret().getBytes(StandardCharsets.UTF_8));
        this.accessTokenValidity = jwtProperties.accessTokenValidity();
    }

    public String createAccessToken(Long userId, UserRole role) {
        Date issuedAt = new Date();
        Date expiration = new Date(issuedAt.getTime() + accessTokenValidity.toMillis());

        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim(CLAIM_ROLE, role.name())
                .issuedAt(issuedAt)
                .expiration(expiration)
                .signWith(secretKey, Jwts.SIG.HS256)
                .compact();
    }

    /** 서명·만료를 검증하고 주체를 꺼낸다. 유효하지 않으면 JwtException 계열이 던져진다. */
    public AuthUser parseAccessToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return new AuthUser(Long.valueOf(claims.getSubject()), UserRole.valueOf(claims.get(CLAIM_ROLE, String.class)));
    }

    public long getAccessTokenValiditySeconds() {
        return accessTokenValidity.toSeconds();
    }
}
