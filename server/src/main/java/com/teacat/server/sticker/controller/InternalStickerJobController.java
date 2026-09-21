package com.teacat.server.sticker.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.sticker.dto.request.StickerJobCompleteRequest;
import com.teacat.server.sticker.dto.request.StickerJobFailRequest;
import com.teacat.server.sticker.dto.response.StickerJobClaimResponse;
import com.teacat.server.sticker.service.StickerJobWorkerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/**
 * 워커(GPU 노트북)가 부르는 내부 API.
 *
 * <p>사람이 아니라 남의 프로세스가 부른다. 로그인 세션이 없으므로 {@code X-Internal-Api-Key}
 * 헤더 하나로 인증한다 — {@code SecurityConfig} 에서 {@code /internal/**} 은 스프링 시큐리티를
 * 통과시키고, 🔴 <b>키 검사는 이 컨트롤러가 한다.</b> 메서드를 늘릴 때 {@code verifyKey} 를
 * 빠뜨리면 그 순간 인터넷에 열린 API 가 된다 ({@code StickerWorkerApiIntegrationTests} 가 지킨다).
 *
 * <p>바깥에서 보이는 주소는 {@code /api/internal/ai-jobs/...} 다 ({@code context-path: /api}).
 *
 * <p>🔴 <b>경로·헤더·필드 이름이 노트북의 계약이다.</b> 바꾸면 노트북도 고쳐야 한다
 * ({@code ai-sticker-lab/sticker_worker_qwen.py}).
 */
@Tag(name = "AI 스티커 (내부)", description = "GPU 워커가 호출하는 내부 API")
@RestController
@RequestMapping("/internal/ai-jobs")
@RequiredArgsConstructor
public class InternalStickerJobController {

    private static final String INTERNAL_API_KEY_HEADER = "X-Internal-Api-Key";
    private static final String WORKER_ID_HEADER = "X-Worker-Id";
    private static final String UNKNOWN_WORKER = "unknown";

    private final StickerJobWorkerService workerService;

    @Operation(summary = "일감 받기",
            description = """
                    기다리는 작업 하나를 집어 RUNNING 으로 바꾸고 돌려줍니다. 없으면 204 입니다.
                    고르기와 표시가 한 문장(FOR UPDATE SKIP LOCKED)이라 워커가 여럿이어도 같은 작업을 두 번 집지 않습니다.
                    집어간 뒤 5분 안에 complete/fail 이 없으면 서버가 다시 줄을 세웁니다.
                    """)
    @GetMapping("/next")
    public ResponseEntity<BaseResponse<StickerJobClaimResponse>> next(
            @Parameter(description = "내부 API 키", required = true)
            @RequestHeader(name = INTERNAL_API_KEY_HEADER, required = false) String internalApiKey,
            @Parameter(description = "워커 식별자. 어느 워커가 집었는지 기록합니다")
            @RequestHeader(name = WORKER_ID_HEADER, required = false) String workerId) {
        workerService.verifyKey(internalApiKey);

        Optional<StickerJobClaimResponse> claimed =
                workerService.claimNext(workerId == null || workerId.isBlank() ? UNKNOWN_WORKER : workerId);

        return claimed
                .map(job -> ResponseEntity.ok(BaseResponse.success(job)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @Operation(summary = "결과 올리기",
            description = """
                    결과 PNG 를 저장하고 작업을 DONE 으로 바꿉니다. 이미 DONE 이면 아무것도 하지 않고 200 입니다
                    (응답을 못 받아 다시 보낸 경우라 에러가 아닙니다).
                    서버가 되돌린 뒤 늦게 도착한 결과는 409 STICKER_008 입니다.
                    """)
    @PostMapping("/{jobId}/complete")
    public ResponseEntity<BaseResponse<Void>> complete(
            @Parameter(description = "내부 API 키", required = true)
            @RequestHeader(name = INTERNAL_API_KEY_HEADER, required = false) String internalApiKey,
            @PathVariable Long jobId,
            @Valid @RequestBody StickerJobCompleteRequest request) {
        workerService.verifyKey(internalApiKey);
        workerService.complete(jobId, request);

        return ResponseEntity.ok(BaseResponse.success("결과를 저장했습니다."));
    }

    @Operation(summary = "실패 신고",
            description = """
                    작업을 FAILED 로 끝냅니다. 재시도하지 않습니다 — 워커가 해보고 안 된 것이라 다시 줘도 같은 결과일 가능성이 큽니다.
                    message 는 서버 로그에만 남습니다.
                    """)
    @PostMapping("/{jobId}/fail")
    public ResponseEntity<BaseResponse<Void>> fail(
            @Parameter(description = "내부 API 키", required = true)
            @RequestHeader(name = INTERNAL_API_KEY_HEADER, required = false) String internalApiKey,
            @PathVariable Long jobId,
            @RequestBody StickerJobFailRequest request) {
        workerService.verifyKey(internalApiKey);
        workerService.fail(jobId, request);

        return ResponseEntity.ok(BaseResponse.success("실패로 기록했습니다."));
    }
}
