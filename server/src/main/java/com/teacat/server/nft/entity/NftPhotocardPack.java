package com.teacat.server.nft.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import java.util.UUID;

/**
 * 카드팩 한 개. 한 행이 팩 하나다 — 잔액은 안 쓴 행의 개수다.
 *
 * <p>소비되면 어느 카드가 나왔고 어느 요청 키였는지가 같은 행에 남는다. 그래서 이 표 하나가
 * 잔액 · 지급 이력 · 멱등키를 다 맡는다.
 */
@Entity
@Table(name = "nft_photocard_packs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NftPhotocardPack {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "source", nullable = false, columnDefinition = "nft_photocard_pack_source", updatable = false)
    private NftPhotocardPackSource source;

    @Column(name = "source_ref", nullable = false, length = 100, updatable = false)
    private String sourceRef;

    @CreationTimestamp
    @Column(name = "granted_at", nullable = false, updatable = false)
    private LocalDateTime grantedAt;

    @Column(name = "consumed_at")
    private LocalDateTime consumedAt;

    /** 이 팩으로 뽑은 카드. 소비 전엔 null */
    @Column(name = "photocard_id")
    private Long photocardId;

    /** 그 뽑기 요청의 Idempotency-Key. 같은 키가 다시 오면 photocardId 의 카드를 그대로 돌려준다 */
    @Column(name = "idempotency_key")
    private UUID idempotencyKey;

    private NftPhotocardPack(Long userId, NftPhotocardPackSource source, String sourceRef) {
        this.userId = userId;
        this.source = source;
        this.sourceRef = sourceRef;
    }

    public static NftPhotocardPack grant(Long userId, NftPhotocardPackSource source, String sourceRef) {
        return new NftPhotocardPack(userId, source, sourceRef);
    }

    public void consume(Long photocardId, UUID idempotencyKey, LocalDateTime now) {
        this.photocardId = photocardId;
        this.idempotencyKey = idempotencyKey;
        this.consumedAt = now;
    }

    public boolean isConsumed() {
        return consumedAt != null;
    }
}
