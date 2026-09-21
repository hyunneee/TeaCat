package com.teacat.server.wallet.entity;

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
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * 가입 시 지갑 발급 요청.
 *
 * <p>가입 트랜잭션은 이 행을 PENDING 으로 넣고 끝난다. 지갑을 실제로 만드는 건 큐 소비자다.
 * 큐 메시지는 신호일 뿐이고 <b>진실은 이 행</b>이다. 메시지가 사라지면 스위퍼가 PENDING 행을 다시 보낸다.
 *
 * <p>{@code derivationIndex} 는 첫 시도에서 확보해 <b>여기 먼저 저장</b>하고 나서 체인을 부른다.
 * 재시도가 같은 인덱스를 다시 쓰기 때문에 체인이 ALREADY_DONE 으로 답하고 시드가 두 번 나가지 않는다.
 */
@Entity
@Table(name = "wallet_provisions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WalletProvision {

    private static final int LAST_ERROR_MAX_LENGTH = 1_000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "wallet_provision_status")
    private WalletProvisionStatus status;

    /** 첫 시도 전에는 null. 한 번 정해지면 바꾸지 않는다 */
    @Column(name = "derivation_index")
    private Integer derivationIndex;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "last_error")
    private String lastError;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "provisioned_at")
    private LocalDateTime provisionedAt;

    private WalletProvision(User user) {
        this.user = user;
        this.status = WalletProvisionStatus.PENDING;
        this.attempts = 0;
    }

    public static WalletProvision pending(User user) {
        return new WalletProvision(user);
    }

    public boolean isDone() {
        return status == WalletProvisionStatus.DONE;
    }

    public boolean hasDerivationIndex() {
        return derivationIndex != null;
    }

    public void assignDerivationIndex(int derivationIndex) {
        if (this.derivationIndex != null) {
            throw new IllegalStateException(
                    "파생 인덱스는 한 번만 정한다. provisionId=" + id + " 기존=" + this.derivationIndex);
        }
        this.derivationIndex = derivationIndex;
    }

    public void markDone() {
        this.status = WalletProvisionStatus.DONE;
        this.provisionedAt = LocalDateTime.now();
        this.lastError = null;
    }

    public void recordFailure(String message) {
        this.attempts++;
        this.lastError = message == null ? null
                : message.length() > LAST_ERROR_MAX_LENGTH ? message.substring(0, LAST_ERROR_MAX_LENGTH) : message;
    }
}
