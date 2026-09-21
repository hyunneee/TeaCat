package com.teacat.server.notification.dto.response;

import com.teacat.server.notification.entity.Notification;
import com.teacat.server.notification.entity.NotificationType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "알림 한 건")
public record NotificationResponse(
        @Schema(description = "알림 ID", example = "17")
        Long id,
        @Schema(description = "알림 종류", example = "RESALE_WON")
        NotificationType type,
        @Schema(description = "제목", example = "취소표 추첨에 당첨됐어요 🎉")
        String title,
        @Schema(description = "본문", example = "BTS 월드투어 A구역 — 09-19 21:10 까지 예매를 마쳐주세요.")
        String body,
        @Schema(description = "누르면 이동할 프론트 경로", example = "/my/resale", nullable = true)
        String linkUrl,
        @Schema(description = "관련 리소스 종류", example = "RESALE_ENTRY", nullable = true)
        String refType,
        @Schema(description = "관련 리소스 ID", example = "123", nullable = true)
        Long refId,
        @Schema(description = "읽었는가", example = "false")
        boolean read,
        @Schema(description = "읽은 시각", nullable = true)
        LocalDateTime readAt,
        @Schema(description = "생성 시각")
        LocalDateTime createdAt
) {
    public static NotificationResponse of(Notification n) {
        return new NotificationResponse(n.getId(), n.getType(), n.getTitle(), n.getBody(), n.getLinkUrl(),
                n.getRefType(), n.getRefId(), n.isRead(), n.getReadAt(), n.getCreatedAt());
    }
}
