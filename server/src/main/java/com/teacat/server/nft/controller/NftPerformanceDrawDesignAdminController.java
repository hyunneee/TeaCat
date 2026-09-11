package com.teacat.server.nft.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.nft.dto.request.NftPoolAddRequest;
import com.teacat.server.nft.dto.response.NftPerformancePoolResponse;
import com.teacat.server.nft.service.NftPhotocardPoolService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "NFT 공연별 뽑기 풀", description = "공연에서 뽑힐 카드를 고르는 ADMIN API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/performances/{performanceId}/draw-designs")
@RequiredArgsConstructor
public class NftPerformanceDrawDesignAdminController {

    private final NftPhotocardPoolService poolService;

    @Operation(
            summary = "공연 뽑기 풀 조회",
            description = """
                    ADMIN 전용 API입니다. 이 공연의 팩에서 뽑힐 도안들입니다.

                    - 공연 전용 도안(자동 발급용, `drawPool: false`)은 **빠집니다.**
                    - 🔴 `seatCapacity`는 **전 회차 좌석 합계**(구역 정원 합 × 회차 수)입니다.
                      수량은 공연 단위로 붙는데 관객은 회차마다 있어서, 회차 수만큼 곱하는 것을
                      잊으면 뒤 회차 관객이 못 뽑습니다. `sufficient: false`면 화면에서 경고하세요.
                    - `poolRemaining`이 잔여 합계입니다.
                    """
    )
    @GetMapping
    public ResponseEntity<BaseResponse<NftPerformancePoolResponse>> findPool(
            @Parameter(description = "공연 ID", example = "1") @PathVariable Long performanceId) {
        return ResponseEntity.ok(BaseResponse.success(poolService.findPerformancePool(performanceId)));
    }

    @Operation(
            summary = "공연 뽑기 풀에 카드 넣기",
            description = """
                    ADMIN 전용 API입니다. 템플릿을 고르고 **수량을 적으면** 그 공연 전용 도안이
                    만들어지고 온체인에 등록됩니다.

                    🔴 **되돌릴 수 없습니다.** `totalSupply`가 온체인 `maxSupply`로 박히고,
                    **첫 장이 발급되면 올리는 것도 내리는 것도 불가능**합니다(컨트랙트가 거절).
                    한 장도 안 나갔으면 도안 재등록으로 고칠 수 있습니다
                    (`POST /admin/photocard-designs/{designId}/chain-registration`).
                    저장 전에 확인 단계를 두세요.

                    🔴 **같은 템플릿이라도 공연마다 다른 온체인 tokenId입니다.** 그림이 같아도
                    공연 A의 카드와 공연 B의 카드는 다른 수집품이고 마켓에서 따로 거래됩니다.
                    목록·상세에서 공연명을 함께 보여주세요(도안 이름에도 공연이 들어갑니다).

                    - **하나라도 잘못되면 아무것도 만들지 않습니다** — 검증을 먼저 다 합니다.
                    - 이미지는 다시 올리지 않습니다. 템플릿의 CID를 그대로 가리킵니다.
                    - 온체인 등록이 실패해도 **도안은 남습니다**(`chainStatus: PENDING`). 재시도하세요.
                    - 응답의 `sufficient`로 수량이 좌석 수에 맞는지 바로 확인하세요.
                    """
    )
    @PostMapping
    public ResponseEntity<BaseResponse<NftPerformancePoolResponse>> addToPool(
            @Parameter(description = "공연 ID", example = "1") @PathVariable Long performanceId,
            @Valid @RequestBody NftPoolAddRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(BaseResponse.success(
                "공연 뽑기 풀에 넣었습니다.",
                poolService.addToPerformance(performanceId, request)));
    }
}
