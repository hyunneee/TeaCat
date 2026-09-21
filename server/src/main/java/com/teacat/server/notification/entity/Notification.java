package com.teacat.server.notification.entity;

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

import java.time.LocalDateTime;

/**
 * 인앱 알림 한 건.
 *
 * <p>푸시(VAPID)나 메일은 아직 없다. 프론트가 주기적으로 읽어 가고, 브라우저 알림은 프론트가
 * 자기 판단으로 띄운다. 채널이 늘어나도 <b>이 행이 원본</b>이다 — 보냈는지와 별개로 남는다.
 */
@Entity
@Table(name = "notifications")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 40)
    private NotificationType type;

    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Column(name = "body", nullable = false, length = 500)
    private String body;

    /** 누르면 갈 프론트 경로 */
    @Column(name = "link_url", length = 300)
    private String linkUrl;

    @Column(name = "ref_type", length = 40)
    private String refType;

    @Column(name = "ref_id")
    private Long refId;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private Notification(Long userId, NotificationType type, String title, String body,
                         String linkUrl, String refType, Long refId) {
        this.userId = userId;
        this.type = type;
        this.title = truncate(title, 100);
        this.body = truncate(body, 500);
        this.linkUrl = linkUrl;
        this.refType = refType;
        this.refId = refId;
    }

    public static Notification of(Long userId, NotificationType type, String title, String body,
                                  String linkUrl, String refType, Long refId) {
        return new Notification(userId, type, title, body, linkUrl, refType, refId);
    }

    public boolean isRead() {
        return readAt != null;
    }

    public boolean isOwnedBy(Long userId) {
        return this.userId.equals(userId);
    }

    public void markRead(LocalDateTime now) {
        if (readAt == null) {
            readAt = now;
        }
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return "";
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
