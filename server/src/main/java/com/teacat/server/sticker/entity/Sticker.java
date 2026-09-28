package com.teacat.server.sticker.entity;

import com.teacat.server.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

/**
 * 만들어진 스티커 한 장. 작업이 DONE 이 되는 순간 서버가 만들어 두므로 따로 "저장" 요청이 없다.
 *
 * <p>삭제는 소프트 삭제다. 🔴 <b>MinIO 오브젝트는 지우지 않는다</b> — 신고가 들어왔을 때
 * 볼 수 있어야 하고, 사용자가 실수로 지운 것도 되살릴 수 있다.
 */
@Entity
@Table(name = "stickers")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Sticker {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 🔴 {@code uq_stickers_job} 이 한 작업에 스티커 하나를 보장한다 */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", nullable = false, updatable = false)
    private StickerJob job;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @Column(name = "image_key", nullable = false, updatable = false)
    private String imageKey;

    /** 아직 쓰지 않는다. 공개 스티커가 생기면 이 칸이 정한다 */
    @Column(name = "visibility", nullable = false, length = 10)
    private String visibility;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    /**
     * 꾸미기 "완료하기" 로 소모된 시각. null 이면 아직 안 썼다.
     *
     * <p>🔴 <b>되돌릴 수 없다.</b> 꾸미는 중에는 옮기고 빼고 자유지만, 완료를 누르는 순간
     * 확정된다. 카드가 팔리면 스티커도 카드를 따라가고 판 사람에게 돌아오지 않는다.
     */
    @Column(name = "used_at")
    private OffsetDateTime usedAt;

    /** 어느 카드에 붙었는지. {@code usedAt} 과 항상 함께 채워진다 */
    @Column(name = "used_photocard_id")
    private Long usedPhotocardId;

    private Sticker(StickerJob job, User user, String imageKey) {
        this.job = job;
        this.user = user;
        this.imageKey = imageKey;
        this.visibility = "PRIVATE";
    }

    public static Sticker of(StickerJob job, User user, String imageKey) {
        return new Sticker(job, user, imageKey);
    }

    public void softDelete() {
        this.deletedAt = OffsetDateTime.now();
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public boolean isOwnedBy(Long userId) {
        return user.getId().equals(userId);
    }

    /**
     * 꾸미기 완료로 소모한다. <b>되돌리는 메서드는 없다</b> — 일부러 두지 않았다.
     *
     * <p>이미 소모된 것을 다시 부르면 {@code IllegalStateException} 이다. 부르는 쪽이
     * {@link #isUsed()} 로 먼저 걸러야 한다 — 조용히 덮어쓰면 "어느 카드에 붙었나" 가 틀어진다.
     */
    public void consume(Long photocardId) {
        if (isUsed()) {
            throw new IllegalStateException("이미 사용한 스티커입니다. stickerId=" + id);
        }
        this.usedAt = OffsetDateTime.now();
        this.usedPhotocardId = photocardId;
    }

    public boolean isUsed() {
        return usedAt != null;
    }

    /** 이 카드에 이미 붙어 있는가 — 다시 저장할 때 그대로 남아 있어야 하는 것들이다 */
    public boolean isUsedOn(Long photocardId) {
        return usedPhotocardId != null && usedPhotocardId.equals(photocardId);
    }
}
