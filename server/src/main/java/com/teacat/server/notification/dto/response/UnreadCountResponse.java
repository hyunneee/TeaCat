package com.teacat.server.notification.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "읽지 않은 알림 수")
public record UnreadCountResponse(
        @Schema(description = "읽지 않은 알림 수", example = "2")
        long unreadCount
) {
}
