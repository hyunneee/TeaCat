package com.teacat.server.sticker.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 워커가 "못 만들겠다" 고 신고한다.
 *
 * <p>🔴 {@code message} 원문은 <b>로그에만</b> 남는다. {@code fail_reason} 컬럼이 40자라
 * 잘리고, 로그도 {@code warn} 이다 — {@code error} 로 찍으면 Sentry 이슈가 되어
 * GPU 워커의 OOM 하나하나가 알림이 된다.
 */
@Schema(description = "워커의 실패 신고")
public record StickerJobFailRequest(

        @Schema(description = "실패 사유. 40자까지만 저장되고 원문은 서버 로그에 남습니다",
                example = "CUDA out of memory")
        String message
) {
}
