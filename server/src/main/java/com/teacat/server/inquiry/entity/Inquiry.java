package com.teacat.server.inquiry.entity;

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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * 문의.
 *
 * 답변은 하나뿐이다. 관리자가 답을 달면 ANSWERED 가 되고, 처리까지 끝나면 관리자가 RESOLVED 로 옮긴다.
 * 작성자는 <b>답변이 달리기 전(OPEN)</b> 에만 고치거나 지울 수 있다 — 답변이 달린 글이 사라지면
 * 대화가 끊긴 채로 남는다.
 *
 * 상태 전이 규칙은 DB CHECK 으로도 막혀 있다. 코드가 실수해도 데이터는 깨지지 않는다.
 */
@Entity
@Table(name = "inquiries")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Inquiry {

    public static final int TITLE_MAX_LENGTH = 100;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "type", nullable = false, columnDefinition = "inquiry_type")
    private InquiryType type;

    @Column(name = "title", nullable = false, length = TITLE_MAX_LENGTH)
    private String title;

    @Column(name = "content", nullable = false, columnDefinition = "text")
    private String content;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "inquiry_status")
    private InquiryStatus status;

    @Column(name = "answer", columnDefinition = "text")
    private String answer;

    /** 답변한 관리자. 누가 답했는지 남겨야 나중에 확인할 수 있다 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "answered_by")
    private User answeredBy;

    @Column(name = "answered_at")
    private LocalDateTime answeredAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private Inquiry(User user, InquiryType type, String title, String content) {
        this.user = user;
        this.type = type;
        this.title = title;
        this.content = content;
        this.status = InquiryStatus.OPEN;
    }

    public static Inquiry create(User user, InquiryType type, String title, String content) {
        return new Inquiry(user, type, title, content);
    }

    /** 답변이 달리기 전에만 고칠 수 있다 */
    public void edit(InquiryType type, String title, String content) {
        this.type = type;
        this.title = title;
        this.content = content;
    }

    /** 관리자 답변. 처음 달면 ANSWERED 가 되고, 이미 답한 글이면 내용만 고친다 */
    public void answerBy(User admin, String answer, LocalDateTime answeredAt) {
        this.answer = answer;
        this.answeredBy = admin;
        this.answeredAt = answeredAt;

        if (this.status == InquiryStatus.OPEN) {
            this.status = InquiryStatus.ANSWERED;
        }
    }

    /** 해결 처리. 답변이 있어야만 넘어갈 수 있다 */
    public void resolve(LocalDateTime resolvedAt) {
        this.status = InquiryStatus.RESOLVED;
        this.resolvedAt = resolvedAt;
    }

    /** 해결을 되돌린다 (잘못 눌렀거나 다시 문제가 된 경우) */
    public void reopen() {
        this.status = InquiryStatus.ANSWERED;
        this.resolvedAt = null;
    }

    public boolean isAnswered() {
        return this.answer != null;
    }

    public boolean isOwnedBy(Long userId) {
        return this.user.getId().equals(userId);
    }
}
