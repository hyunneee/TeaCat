package com.teacat.server.sticker.entity;

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

import java.time.OffsetDateTime;

/**
 * 스티커 생성 작업 하나.
 *
 * <p>멱등키 · 오늘 몫 · 워커 배정 · 재시도가 전부 이 행에 있다. 큐 미들웨어가 없고
 * 워커가 {@code GET /api/internal/ai-jobs/next} 로 직접 집어간다(pull).
 *
 * <p>🔴 <b>상태 전이는 이 클래스의 메서드로만 한다.</b> 다만 {@code PENDING → RUNNING}
 * 만은 예외로 리포지토리의 네이티브 {@code claimNext} 가 한다 — 고르기와 표시를 한 문장으로
 * 묶어야 워커 둘이 같은 작업을 집지 않는다. 같은 이유로 스위퍼의 되돌림·포기도 집합 UPDATE 다.
 */
@Entity
@Table(name = "sticker_jobs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StickerJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    private StickerJobStatus status;

    @Column(name = "idempotency_key", nullable = false, updatable = false, length = 64)
    private String idempotencyKey;

    /** 낙서 원본의 MinIO key. 신고 대응용이라 지우지 않는다 */
    @Column(name = "sketch_key", nullable = false, updatable = false)
    private String sketchKey;

    /** 비어 있으면 워커의 캡셔너가 낙서를 읽어 채운다 */
    @Column(name = "subject", length = 20, updatable = false)
    private String subject;

    /** 🔴 null 이면 안 된다. 워커가 자기 기본값을 써서 "다시 만들기" 가 같은 그림을 준다 */
    @Column(name = "seed", updatable = false)
    private Integer seed;

    /* 🔴 params_json 은 일부러 매핑하지 않는다.
       하이버네이트의 JSON 매핑({@code @JdbcTypeCode(SqlTypes.JSON)})은 이 값을 한 번 더
       JSON 문자열로 감싸 넣을 수 있고, 이 프로젝트는 Jackson 3(tools.jackson)이라
       하이버네이트가 기대하는 Jackson 2 포맷 매퍼가 아예 없을 수도 있다.
       우리가 읽지도 않는 곁다리 기록 때문에 그 불확실성을 떠안을 이유가 없다.
       쓰기는 StickerJobRepository.saveMeta 가 명시적 캐스트로 한다.
       model_name · model_version · visibility 도 같은 이유는 아니지만 매핑하지 않는다 —
       아무도 쓰지 않는다. ddl-auto: validate 는 표에만 있는 컬럼을 문제 삼지 않는다. */

    @Column(name = "fail_reason", length = 40)
    private String failReason;

    @Column(name = "worker_id")
    private String workerId;

    @Column(name = "retry_count", nullable = false)
    private short retryCount;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "claimed_at")
    private OffsetDateTime claimedAt;

    @Column(name = "finished_at")
    private OffsetDateTime finishedAt;

    private StickerJob(User user, String idempotencyKey, String sketchKey, String subject, int seed) {
        this.user = user;
        this.idempotencyKey = idempotencyKey;
        this.sketchKey = sketchKey;
        this.subject = subject;
        this.seed = seed;
        this.status = StickerJobStatus.PENDING;
        this.retryCount = 0;
    }

    public static StickerJob pending(User user, String idempotencyKey, String sketchKey,
                                     String subject, int seed) {
        return new StickerJob(user, idempotencyKey, sketchKey, subject, seed);
    }

    /** 결과가 도착했다. 워커가 보낸 meta 는 {@code StickerJobRepository.saveMeta} 가 따로 넣는다 */
    public void complete() {
        this.status = StickerJobStatus.DONE;
        this.finishedAt = OffsetDateTime.now();
    }

    /** 못 만들었다. 사유는 컬럼 길이에 맞춰 잘린다 — 원문은 로그에만 남긴다 */
    public void fail(String reason) {
        this.status = StickerJobStatus.FAILED;
        this.failReason = StickerFailReason.truncate(reason);
        this.finishedAt = OffsetDateTime.now();
    }

    public boolean isRunning() {
        return status == StickerJobStatus.RUNNING;
    }

    public boolean isDone() {
        return status == StickerJobStatus.DONE;
    }

    public boolean isOwnedBy(Long userId) {
        return user.getId().equals(userId);
    }
}
