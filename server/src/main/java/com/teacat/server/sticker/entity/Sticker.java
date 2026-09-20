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
}
