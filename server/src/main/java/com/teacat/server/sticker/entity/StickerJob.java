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

    /**
     * 사용자가 고른 잉크 색 {@code #RRGGBB}. 안 골랐으면 null.
     *
     * <p>🔴 이 값이 결과 색을 좌우한다 — 워커에 색 이름으로 넘어가면 모델이 선명하게 칠하고,
     * 없으면 얇은 선화가 회색빛으로 바랜다. 변환은 {@link StickerInkColor} 가 한다.
     */
    @Column(name = "ink_color", length = 7, updatable = false)
    private String inkColor;

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

    /**
     * 이 건을 만들며 태운 캣머니. 0 이면 하루 무료 몫으로 만든 것 (2026-09-23).
     *
     * <p>🔴 <b>실패하면 이 금액을 돌려줘야 한다.</b> 얼마를 받았는지 남기지 않으면
     * 무엇을 돌려줄지 알 수 없다. 실패한 건이 하루 몫에서 안 깎이는 것과 같은 원칙이다.
     */
    @Column(name = "paid_cat", nullable = false)
    private int paidCat;

    /** 실패해서 돌려준 시각. {@code paidCat > 0} 인데 비어 있으면 아직 안 돌려줬다 */
    @Column(name = "refunded_at")
    private OffsetDateTime refundedAt;

    /** 환불을 마쳤다고 표시한다. 🔴 표시가 없으면 스위퍼가 돌 때마다 또 돌려준다 */
    public void markRefunded() {
        this.refundedAt = OffsetDateTime.now();
    }

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "claimed_at")
    private OffsetDateTime claimedAt;

    @Column(name = "finished_at")
    private OffsetDateTime finishedAt;

    private StickerJob(User user, String idempotencyKey, String sketchKey,
                       String subject, int seed, String inkColor) {
        this.user = user;
        this.idempotencyKey = idempotencyKey;
        this.sketchKey = sketchKey;
        this.subject = subject;
        this.seed = seed;
        this.inkColor = inkColor;
        this.status = StickerJobStatus.PENDING;
        this.retryCount = 0;
    }

    public static StickerJob pending(User user, String idempotencyKey, String sketchKey,
                                     String subject, int seed, String inkColor, int paidCat) {
        StickerJob job = new StickerJob(user, idempotencyKey, sketchKey, subject, seed, inkColor);
        job.paidCat = paidCat;
        return job;
    }

    /** 워커가 쓰는 색 이름. 색을 안 골랐으면 null 이라 모델이 주제에 맞게 고른다 */
    public String colorChip() {
        return StickerInkColor.toChipName(inkColor);
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
