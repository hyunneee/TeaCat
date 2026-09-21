package com.teacat.server.notification.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.notification.dto.response.NotificationResponse;
import com.teacat.server.notification.dto.response.UnreadCountResponse;
import com.teacat.server.notification.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "알림", description = "인앱 알림 조회·읽음 처리 API (API-316 ~ API-318)")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/me/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @Operation(
            summary = "내 알림 목록 조회",
            description = """
                    최근 50건을 최신순으로 돌려줍니다. (API-316)

                    - `unreadOnly=true` 면 읽지 않은 알림만 돌려줍니다.
                    - 취소표 당첨(`RESALE_WON`)은 결제 기한이 있으므로 `linkUrl`(`/my/resale`)로 바로 보내주세요.
                    - 서버 푸시는 아직 없습니다. 앱이 열려 있는 동안 주기적으로 읽어 가세요.
                    """
    )
    @ApiResponses(@ApiResponse(responseCode = "200", description = "조회 성공"))
    @GetMapping
    public ResponseEntity<BaseResponse<List<NotificationResponse>>> list(
            @Parameter(description = "읽지 않은 알림만", example = "false")
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success(notificationService.list(authUser.id(), unreadOnly)));
    }

    @Operation(summary = "읽지 않은 알림 수", description = "배지에 쓸 숫자 하나만 돌려줍니다. (API-318)")
    @ApiResponses(@ApiResponse(responseCode = "200", description = "조회 성공"))
    @GetMapping("/unread-count")
    public ResponseEntity<BaseResponse<UnreadCountResponse>> unreadCount(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success(notificationService.unreadCount(authUser.id())));
    }

    @Operation(summary = "알림 읽음 처리", description = "이미 읽은 알림을 다시 읽어도 시각은 바뀌지 않습니다. (API-317)")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "처리 성공"),
            @ApiResponse(responseCode = "404", description = "`ERR_NOTIFICATION_001` : 내 알림이 아니거나 없음")
    })
    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<BaseResponse<NotificationResponse>> markRead(
            @PathVariable Long notificationId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success(
                notificationService.markRead(authUser.id(), notificationId)));
    }

    @Operation(summary = "알림 전체 읽음 처리", description = "읽지 않은 알림을 모두 읽음으로 바꿉니다. (API-317)")
    @ApiResponses(@ApiResponse(responseCode = "200", description = "처리 성공"))
    @PatchMapping("/read-all")
    public ResponseEntity<BaseResponse<UnreadCountResponse>> markAllRead(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        notificationService.markAllRead(authUser.id());
        return ResponseEntity.ok(BaseResponse.success("알림을 모두 읽음 처리했습니다.",
                notificationService.unreadCount(authUser.id())));
    }
}
