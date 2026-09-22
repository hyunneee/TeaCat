package com.teacat.server.sticker.dto.response;

import com.teacat.server.sticker.entity.StickerJob;
import com.teacat.server.sticker.entity.StickerJobStatus;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 작업 상태. 프론트가 이 응답을 폴링한다.
 *
 * <p>{@code sticker} · {@code failReason} 은 null 이면 {@code @JsonInclude(NON_NULL)} 로
 * 응답에서 빠진다 — 프론트 타입의 {@code sticker?} · {@code failReason?} 와 그대로 맞는다.
 */
@Schema(description = "스티커 생성 작업 상태")
public record StickerJobResponse(

        @Schema(description = "작업 id", example = "41")
        Long jobId,

        @Schema(description = "PENDING | RUNNING | DONE | FAILED")
        StickerJobStatus status,

        @Schema(description = "DONE 일 때만 있습니다")
        StickerResponse sticker,

        @Schema(description = "FAILED 일 때만 있습니다. 화면에 그대로 띄울 문장이 아니라 코드입니다",
                example = "NO_WORKER")
        String failReason
) {

    public static StickerJobResponse of(StickerJob job, StickerResponse sticker) {
        return new StickerJobResponse(job.getId(), job.getStatus(), sticker, job.getFailReason());
    }
}
