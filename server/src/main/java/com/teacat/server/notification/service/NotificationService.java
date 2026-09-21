package com.teacat.server.notification.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.notification.dto.response.NotificationResponse;
import com.teacat.server.notification.dto.response.UnreadCountResponse;
import com.teacat.server.notification.entity.Notification;
import com.teacat.server.notification.entity.NotificationType;
import com.teacat.server.notification.exception.NotificationErrorCode;
import com.teacat.server.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 인앱 알림.
 *
 * <p>{@link #notify} 는 부르는 쪽의 트랜잭션에 <b>합류</b>한다. 당첨 기록과 당첨 알림이 한 트랜잭션에서
 * 같이 커밋되거나 같이 사라져야 한다 — 알림만 남고 당첨은 롤백된 상태가 가장 나쁘다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final Limit PAGE = Limit.of(50);

    private final NotificationRepository notificationRepository;

    @Transactional
    public Notification notify(Long userId, NotificationType type, String title, String body,
                               String linkUrl, String refType, Long refId) {
        Notification saved = notificationRepository.save(
                Notification.of(userId, type, title, body, linkUrl, refType, refId));
        log.info("알림 생성 userId={} type={} refType={} refId={}", userId, type, refType, refId);
        return saved;
    }

    /** 최근 50건. 그보다 오래된 알림은 의미가 없다 */
    @Transactional(readOnly = true)
    public List<NotificationResponse> list(Long userId, boolean unreadOnly) {
        List<Notification> rows = unreadOnly
                ? notificationRepository.findByUserIdAndReadAtIsNullOrderByCreatedAtDescIdDesc(userId, PAGE)
                : notificationRepository.findByUserIdOrderByCreatedAtDescIdDesc(userId, PAGE);
        return rows.stream().map(NotificationResponse::of).toList();
    }

    @Transactional(readOnly = true)
    public UnreadCountResponse unreadCount(Long userId) {
        return new UnreadCountResponse(notificationRepository.countByUserIdAndReadAtIsNull(userId));
    }

    @Transactional
    public NotificationResponse markRead(Long userId, Long notificationId) {
        Notification notification = notificationRepository.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new BusinessException(NotificationErrorCode.NOTIFICATION_NOT_FOUND));
        notification.markRead(LocalDateTime.now());
        return NotificationResponse.of(notification);
    }

    @Transactional
    public int markAllRead(Long userId) {
        return notificationRepository.markAllRead(userId, LocalDateTime.now());
    }
}
