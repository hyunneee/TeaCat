package com.teacat.server.sticker.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.sticker.dto.request.StickerCreateRequest;
import com.teacat.server.sticker.dto.response.StickerCreateResponse;
import com.teacat.server.sticker.dto.response.StickerJobResponse;
import com.teacat.server.sticker.dto.response.StickerQuotaResponse;
import com.teacat.server.sticker.dto.response.StickerResponse;
import com.teacat.server.sticker.service.StickerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * AI 스티커. 낙서를 보내면 워커(GPU)가 그리고, 프론트는 작업 상태를 폴링한다.
 *
 * <p>{@code /users/me/stickers} 도 여기 있다. 경로는 {@code /users} 로 시작하지만
 * Swagger 그룹은 도메인 패키지 기준이고, 내 스티커 목록은 스티커 도메인의 일이다.
 */
@Tag(name = "AI 스티커", description = "낙서로 스티커 만들기 · 내 스티커")
@RestController
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class StickerController {

    private final StickerService stickerService;

    @Operation(summary = "스티커 만들기",
            description = """
                    낙서 PNG 의 base64 를 보내면 작업을 만들고 바로 202 를 돌려줍니다. 그림은 아직 없습니다 —
                    `GET /stickers/jobs/{jobId}` 를 폴링해 DONE 이 되기를 기다리세요.
                    같은 Idempotency-Key 로 다시 오면 새로 만들지 않고 그때 준 작업을 그대로 돌려줍니다.
                    오늘 몫을 다 쓰면 429 STICKER_001 입니다. 실패한 작업은 몫에서 빠지므로 다시 시도할 수 있습니다.
                    seed 를 생략하면 서버가 뽑습니다. '다시 만들기' 는 seed 를 바꿔 보내세요 — 같은 seed 면 같은 그림이 나옵니다.
                    """)
    @Parameter(name = "Idempotency-Key", description = "중복 생성 방지용 UUID", required = true,
            in = ParameterIn.HEADER, example = "550e8400-e29b-41d4-a716-446655440000")
    @PostMapping("/stickers")
    public ResponseEntity<BaseResponse<StickerCreateResponse>> create(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody StickerCreateRequest request) {
        StickerCreateResponse response = stickerService.create(authUser.id(), request, idempotencyKey);

        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(BaseResponse.success(response));
    }

    @Operation(summary = "작업 상태 조회",
            description = """
                    폴링용입니다. DONE 이면 sticker 가, FAILED 면 failReason 이 함께 옵니다 (그 외에는 필드가 빠집니다).
                    본인 작업만 볼 수 있습니다.
                    """)
    @GetMapping("/stickers/jobs/{jobId}")
    public ResponseEntity<BaseResponse<StickerJobResponse>> job(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long jobId) {
        return ResponseEntity.ok(BaseResponse.success(stickerService.job(authUser.id(), jobId)));
    }

    @Operation(summary = "오늘 몫 조회",
            description = "KST 기준 오늘 만든 장수입니다. 실패한 작업은 세지 않습니다.")
    @GetMapping("/stickers/quota")
    public ResponseEntity<BaseResponse<StickerQuotaResponse>> quota(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success(stickerService.quota(authUser.id())));
    }

    @Operation(summary = "내 스티커 목록",
            description = "최근 것이 먼저 옵니다. 지운 것은 나오지 않습니다. imageUrl 은 만료되므로 저장하지 마세요.")
    @GetMapping("/users/me/stickers")
    public ResponseEntity<BaseResponse<List<StickerResponse>>> mine(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success(stickerService.mine(authUser.id())));
    }

    @Operation(summary = "스티커 삭제",
            description = "본인 것만 지울 수 있습니다. 이미 지운 스티커를 다시 지우면 404 STICKER_005 입니다.")
    @DeleteMapping("/stickers/{stickerId}")
    public ResponseEntity<BaseResponse<Void>> delete(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long stickerId) {
        stickerService.delete(authUser.id(), stickerId);

        return ResponseEntity.ok(BaseResponse.success("스티커를 삭제했습니다."));
    }
}
