package com.teacat.server.auth.entity;

import com.teacat.server.auth.security.ClientRequest;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * 로그인 성공 한 건의 단말 기록. 이상거래 심사의 R8(계정 탈취 의심)이 "처음 보는 단말인가" 를 판정할 때 읽는다.
 *
 * <p>IP·UA 를 모두 알 때만 남긴다. 반쪽 기록은 "같은 단말" 판정에 쓸 수 없다.
 * 보관 기간이 지난 행은 심사 유지 스위퍼가 지운다({@code nft.trade.review.login-event-retention}).
 */
@Entity
@Table(name = "user_login_events")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserLoginEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** users.id — 연관을 걷지 않으므로 id 만 둔다 */
    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "client_ip", nullable = false, updatable = false, length = 45)
    private String clientIp;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "user_agent_hash", nullable = false, updatable = false, length = 64)
    private String userAgentHash;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private UserLoginEvent(Long userId, String clientIp, String userAgentHash) {
        this.userId = userId;
        this.clientIp = clientIp;
        this.userAgentHash = userAgentHash;
    }

    /** @return IP·UA 중 하나라도 모르면 null — 기록하지 않는다 */
    public static UserLoginEvent of(Long userId, ClientRequest client) {
        if (client == null || client.ip() == null || client.userAgentHash() == null) {
            return null;
        }
        return new UserLoginEvent(userId, client.ip(), client.userAgentHash());
    }
}
