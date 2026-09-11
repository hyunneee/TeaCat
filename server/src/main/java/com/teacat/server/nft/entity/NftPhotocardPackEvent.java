package com.teacat.server.nft.entity;

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

import java.time.LocalDateTime;

/**
 * 카드팩 이벤트 한 건.
 *
 * <p>{@code code} 가 지급된 팩의 {@code source_ref} 로 들어가고, 그 값이 <b>계정당 1회</b>를
 * 지킨다({@code uq_nft_photocard_packs_source}). 그래서 code 는 만들 때만 정하고 바꾸지 않는다 —
 * 바꾸면 이미 받은 사람이 또 받는다. 새 이벤트가 필요하면 행을 새로 만든다.
 */
@Entity
@Table(name = "nft_photocard_pack_events")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NftPhotocardPackEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, length = 50, updatable = false)
    private String code;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /** null 이면 즉시 시작 */
    @Column(name = "starts_at")
    private LocalDateTime startsAt;

    /** null 이면 무기한 */
    @Column(name = "ends_at")
    private LocalDateTime endsAt;

    @Column(name = "active", nullable = false)
    private boolean active;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private NftPhotocardPackEvent(String code, String name, LocalDateTime startsAt, LocalDateTime endsAt) {
        this.code = code;
        this.name = name;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.active = true;
    }

    public static NftPhotocardPackEvent create(String code, String name,
                                               LocalDateTime startsAt, LocalDateTime endsAt) {
        return new NftPhotocardPackEvent(code, name, startsAt, endsAt);
    }

    /** 열기/닫기. 기간은 그대로 두고 스위치만 내린다 */
    public void changeActive(boolean active) {
        this.active = active;
    }

    /** 지금 지급 대상인가. {@code active} 만으로는 기간이 안 왔는지 지났는지 구분되지 않는다 */
    public boolean isOngoing(LocalDateTime now) {
        return active
                && (startsAt == null || !startsAt.isAfter(now))
                && (endsAt == null || endsAt.isAfter(now));
    }
}
