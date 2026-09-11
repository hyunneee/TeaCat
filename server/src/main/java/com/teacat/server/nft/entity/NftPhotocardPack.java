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

    /**
     * 이 팩이 어느 회차의 것인가. 이벤트 팩은 null 이고 즉시 열 수 있다.
     *
     * <p><b>개봉 시각을 저장하지 않는 이유가 여기 있다.</b> 값을 얼려 두면 공연을 연기했을 때
     * 개봉 시각만 옛 자리에 남아, 예매 취소 마감(회차에서 매번 계산된다)과 어긋난 그 차이만큼
     * "카드를 뽑고 예매를 취소해 전액 환불받는" 창이 열린다. 회차만 들고 있으면 두 값이
     * 같은 행·같은 식에서 나와 어긋날 수가 없다.
     */
    @Column(name = "performance_detail_id", updatable = false)
    private Long performanceDetailId;

    private NftPhotocardPack(Long userId, NftPhotocardPackSource source, String sourceRef,
                             Long performanceDetailId) {
        this.userId = userId;
        this.source = source;
        this.sourceRef = sourceRef;
        this.performanceDetailId = performanceDetailId;
    }

    /* 2026-09-11: grantEvent / grantForTicket 으로 나눴다. 인자를 한 팩토리로 받으면
       이벤트 쪽 호출부에 null 이 붙는다.
    public static NftPhotocardPack grant(Long userId, NftPhotocardPackSource source, String sourceRef) {
        return new NftPhotocardPack(userId, source, sourceRef);
    }
    */

    /** 이벤트 팩. 회차에 매이지 않고 바로 열 수 있다 */
    public static NftPhotocardPack grantEvent(Long userId, String eventCode) {
        return new NftPhotocardPack(userId, NftPhotocardPackSource.EVENT, eventCode, null);
    }

    /**
     * 티켓 구매 팩. 개봉 시각은 저장하지 않는다 — 그 회차의 공연 일시에서 매번 계산한다.
     */
    public static NftPhotocardPack grantForTicket(Long userId, Long ticketId, Long performanceDetailId) {
        return new NftPhotocardPack(userId, NftPhotocardPackSource.TICKET_PURCHASE,
                ticketId.toString(), performanceDetailId);
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
