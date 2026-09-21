package com.teacat.server.nft.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.performance.service.PerformanceOperatorAccess;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.nft.dto.request.NftDesignDrawPoolRequest;
import com.teacat.server.nft.dto.request.NftPhotocardDesignCreateRequest;
import com.teacat.server.nft.dto.request.NftPoolAddRequest;
import com.teacat.server.nft.dto.response.NftPhotocardDesignResponse;
import com.teacat.server.nft.service.NftPhotocardDesignService;
import com.teacat.server.nft.service.NftPhotocardPoolService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "NFT 포토카드 도안 관리", description = "포토카드 도안 등록(IPFS 핀 + 온체인 등록) API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/photocard-designs")
@RequiredArgsConstructor
@Validated
public class NftPhotocardDesignAdminController {
    private final PerformanceOperatorAccess access;


    private final NftPhotocardDesignService designService;
    private final NftPhotocardPoolService poolService;

    @Operation(
            summary = "포토카드 도안 등록",
            description = """
                    ADMIN 또는 담당 공연 기획자 API입니다. 이미지와 메타데이터 JSON을 IPFS에 핀하고, 도안을 저장한 뒤 온체인에 등록합니다.

                    한정 수량(`totalSupply`)과 메타데이터 CID는 **첫 장이 발급되는 순간 온체인에서 동결**되어 아무도 바꿀 수 없습니다.
                    한 장도 발급되지 않았다면 같은 도안 ID로 다시 등록해 값을 고칠 수 있습니다.

                    핀이 끝난 뒤 온체인 등록에 실패해도 **도안은 저장된 채로 남습니다** (`chainStatus: PENDING`).
                    이 경우 등록 재시도 API로 다시 보내면 되고, 같은 그림을 다시 올릴 필요는 없습니다.
                    """
    )
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BaseResponse<NftPhotocardDesignResponse>> create(
            @AuthenticationPrincipal AuthUser actor,
            @Valid @ModelAttribute NftPhotocardDesignCreateRequest request) {
        access.performance(actor, request.performanceId());

        return ResponseEntity.status(HttpStatus.CREATED).body(BaseResponse.success(
                "포토카드 도안이 등록되었습니다.",
                designService.create(request)));
    }

    @Operation(
            summary = "도안 온체인 등록 재시도",
            description = """
                    ADMIN 또는 담당 공연 기획자 API입니다. IPFS 핀은 끝났는데 온체인 등록이 안 된 도안(`PENDING`, `FAILED`)을 다시 등록합니다.
                    등록은 멱등이라 여러 번 보내도 안전하며, 이미 같은 값으로 등록돼 있으면 새 트랜잭션 없이 확정 처리됩니다.

                    `force=true`는 확정 대기 중(`REGISTERING`)인 도안도 다시 보냅니다. 확정 감시가 멈춰 도안이 계속
                    `REGISTERING`에 머무를 때만 쓰세요.
                    """
    )
    @PostMapping("/{designId}/chain-registration")
    public ResponseEntity<BaseResponse<NftPhotocardDesignResponse>> retryRegistration(
            @AuthenticationPrincipal AuthUser actor,
            @PathVariable @Positive Long designId,
            @RequestParam(defaultValue = "false") boolean force) {
        access.design(actor, designId);

        return ResponseEntity.ok(BaseResponse.success(
                "도안 등록 요청을 보냈습니다.",
                designService.retryRegistration(designId, force)));
    }

    @Operation(summary = "도안 단건 조회", description = "ADMIN 또는 담당 공연 기획자 API입니다. IPFS CID와 온체인 등록 상태를 함께 내려줍니다.")
    @GetMapping("/{designId}")
    public ResponseEntity<BaseResponse<NftPhotocardDesignResponse>> get(
            @AuthenticationPrincipal AuthUser actor,
            @PathVariable @Positive Long designId) {
        access.design(actor, designId);

        return ResponseEntity.ok(BaseResponse.success(designService.get(designId)));
    }

    @Operation(summary = "뽑기 풀 도안 목록 조회",
            description = "ADMIN 전용 API입니다. 뽑기에 나오는 도안 전체와 등록 상태·남은 수량을 봅니다. 등록(REGISTERED)되지 않은 도안은 뽑기에 나오지 않습니다.")
    @GetMapping("/draw-pool")
    public ResponseEntity<BaseResponse<List<NftPhotocardDesignResponse>>> getDrawPool() {
        return ResponseEntity.ok(BaseResponse.success(designService.getDrawPool()));
    }

    @Operation(summary = "공연의 도안 목록 조회", description = "ADMIN 또는 담당 공연 기획자 API입니다. 발급 전에 도안이 전부 등록됐는지 확인하는 용도입니다.")
    @GetMapping
    public ResponseEntity<BaseResponse<List<NftPhotocardDesignResponse>>> getByPerformance(
            @AuthenticationPrincipal AuthUser actor,
            @RequestParam @Positive Long performanceId) {
        access.performance(actor, performanceId);

        return ResponseEntity.ok(BaseResponse.success(designService.getByPerformance(performanceId)));
    }

    @Operation(
            summary = "이벤트 풀에 카드 넣기",
            description = """
                    ADMIN 전용 API입니다. 템플릿을 고르고 수량을 적으면 **이벤트 팩이 뽑는 도안**이
                    만들어집니다. 공연에 넣는 것과 같은 동작이고, 공연이 없다는 점만 다릅니다.

                    이벤트 풀은 **하나를 공유**합니다 — 이벤트 여러 개를 동시에 열어도 같은 카드
                    목록에서 뽑힙니다.

                    🔴 **되돌릴 수 없습니다.** 수량이 온체인 `maxSupply`로 박히고 첫 장 발급 시
                    동결됩니다.
                    """
    )
    @PostMapping("/event-pool")
    public ResponseEntity<BaseResponse<List<NftPhotocardDesignResponse>>> addToEventPool(
            @Valid @RequestBody NftPoolAddRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(BaseResponse.success(
                "이벤트 풀에 넣었습니다.",
                poolService.addToEventPool(request)));
    }

    @Operation(
            summary = "도안을 뽑기 풀에서 빼기 / 다시 넣기",
            description = """
                    ADMIN 또는 담당 공연 기획자 API입니다. **삭제가 아닙니다** — 온체인 등록은 되돌릴 수 없고 이미
                    발행된 카드도 사라지지 않습니다. 앞으로 뽑히지 않게 되는 것뿐입니다.

                    수량이 남았는데 더 안 나가게 하려면 이걸 쓰세요. 온체인 `maxSupply`는 줄일 수
                    없지만(컨트랙트가 거절) 실제 발행은 여기서 멈춥니다.

                    이벤트 풀 도안(공연이 없는 것)은 뺄 수 없습니다(`NFT_048`).

                    **`drawPool: true`로 다시 넣을 때는 도안에 소속(`groupName`)·등급(`grade`)이
                    있어야 합니다(`NFT_043`).** 기존 도안 등록 API로 만든 공연 전용 도안은 둘 다
                    비어 있어 이 방향으로는 넣을 수 없습니다 — 템플릿 기반 도안만 대상입니다.
                    """
    )
    @PatchMapping("/{designId}/draw-pool")
    public ResponseEntity<BaseResponse<NftPhotocardDesignResponse>> changeDrawPool(
            @AuthenticationPrincipal AuthUser actor,
            @PathVariable @Positive Long designId,
            @Valid @RequestBody NftDesignDrawPoolRequest request) {
        access.design(actor, designId);

        return ResponseEntity.ok(BaseResponse.success(
                poolService.changeDrawPool(designId, request.drawPool())));
    }
}
