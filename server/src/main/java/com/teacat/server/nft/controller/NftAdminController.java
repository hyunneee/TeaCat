package com.teacat.server.nft.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.nft.dto.request.NftPhotocardIssueRequest;
import com.teacat.server.nft.dto.response.NftPhotocardIssueResponse;
import com.teacat.server.nft.service.NftService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "NFT 포토카드 관리자", description = "NFT 포토카드 발급 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/performances")
@RequiredArgsConstructor
public class NftAdminController {

    private final NftService nftService;

    @Operation(
            summary = "NFT 포토카드 일괄 발급",
            description = "ADMIN 전용 API입니다. 공연의 확정 티켓마다 포토카드 한 장을 생성하고 요청한 도안별 수량에 맞춰 무작위 배포합니다. "
                    + "배정 수량 합계는 발급 대상 티켓 수와 같아야 하며, 같은 공연에는 한 번만 발급할 수 있습니다. "
                    + "블록체인 미연동 기간에는 민팅 상태를 PENDING으로 저장합니다."
    )
    @PostMapping("/{performanceId}/photocards/issue")
    public ResponseEntity<BaseResponse<NftPhotocardIssueResponse>> issuePhotocards(
            @PathVariable Long performanceId,
            @Valid @RequestBody NftPhotocardIssueRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success(nftService.issuePhotocards(performanceId, request)));
    }
}
