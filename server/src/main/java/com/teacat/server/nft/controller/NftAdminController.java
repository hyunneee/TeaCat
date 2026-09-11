package com.teacat.server.nft.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.nft.dto.request.NftPhotocardIssueRequest;
import com.teacat.server.nft.dto.response.NftPhotocardIssueResponse;
import com.teacat.server.nft.service.NftPhotocardIssuer;
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

    private final NftPhotocardIssuer photocardIssuer;

    @Operation(
            summary = "NFT 포토카드 일괄 발급",
            description = """
                    ADMIN 전용 API입니다. 공연의 확정 티켓마다 포토카드 한 장을 생성하고 요청한 도안별 수량에 맞춰
                    무작위 배포한 뒤, 곧바로 체인에 발행을 요청합니다. 배정 수량 합계는 발급 대상 티켓 수와 같아야 하며,
                    같은 공연에는 한 번만 발급할 수 있습니다.

                    **배정된 도안은 전부 온체인 등록(`REGISTERED`)이 끝나 있어야 합니다.** 미등록 도안이 하나라도
                    섞이면 발행 배치 전체가 실패하므로, 보내기 전에 거절합니다.

                    **뽑기 풀 도안(`drawPool: true`)은 배정할 수 없습니다(`NFT_042`).** 그 도안은
                    카드팩이 뽑을 재고입니다 — 여기서 배정하면 티켓 보유자에게 직접(회수 불가로) 민팅되고
                    그 공연 팩에서 뽑을 카드가 사라집니다. 이벤트 풀 도안(공연 없음)도 같은 이유로 막힙니다.

                    같은 공연에 다시 발급할 수 있는 기준은 **티켓으로 발급된 카드**입니다 — 그 공연
                    카드팩에서 카드가 뽑힌 적이 있어도(`ticket_id` NULL) 이 API는 다시 쓸 수 있습니다.

                    **발급 대상 전원에게 지갑이 있어야 합니다.** 한 명이라도 없으면 발급 전체를 거절합니다 —
                    카드가 절반만 나간 공연을 수습하는 비용이 훨씬 크기 때문입니다.

                    체인 전송이 실패해도 카드 행은 `PENDING`으로 남습니다. 응답의 `failedCount`가 아직 안 나간
                    장수이며, 발행 재시도 API로 이어 보낼 수 있습니다. 민팅은 202로 먼저 끝나고 블록이 실리면
                    블록체인 서비스가 `MINTING → MINTED`로 옮깁니다.
                    """
    )
    @PostMapping("/{performanceId}/photocards/issue")
    public ResponseEntity<BaseResponse<NftPhotocardIssueResponse>> issuePhotocards(
            @PathVariable Long performanceId,
            @Valid @RequestBody NftPhotocardIssueRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success(photocardIssuer.issue(performanceId, request)));
    }

    @Operation(
            summary = "포토카드 온체인 발행 재시도",
            description = """
                    ADMIN 전용 API입니다. 발급은 됐는데 아직 체인에 안 보낸 카드(`PENDING`)를 이어서 발행합니다.
                    같은 카드를 다시 보내도 컨트랙트가 이미 발행된 키를 건너뛰므로 안전하며, 확정을 기다리는 중인
                    `MINTING` 카드는 대상에서 빠집니다.
                    """
    )
    @PostMapping("/{performanceId}/photocards/mint")
    public ResponseEntity<BaseResponse<NftPhotocardIssueResponse>> mintPending(
            @PathVariable Long performanceId) {
        return ResponseEntity.ok(BaseResponse.success(
                "포토카드 발행 요청을 보냈습니다.",
                photocardIssuer.mintPending(performanceId)));
    }

    @Operation(
            summary = "회차 포토카드 자동 발급 수동 실행",
            description = """
                    ADMIN 전용 API입니다. 평소 매시 정각 스케줄러가 하는 "회차 시작 임박 자동 발급" 을 지금 한 번
                    실행합니다. 스케줄러를 기다리지 않고 특정 회차를 발급하거나, 실패한 회차를 다시 시도할 때 씁니다.

                    수량 중심 배정입니다 — 공연에 등록된 도안 재고만큼만 발급하고, 재고가 모자라면 일부 확정 티켓
                    보유자는 카드를 못 받습니다. 지갑이 없는 회원과 온체인 미등록 도안은 대상에서 빠집니다.
                    이미 발급된 회차면 `issuedCount`가 0으로 돌아옵니다(오류 아님).
                    """
    )
    @PostMapping("/{performanceId}/schedules/{scheduleId}/photocards/issue")
    public ResponseEntity<BaseResponse<NftPhotocardIssueResponse>> issueSchedulePhotocards(
            @PathVariable Long performanceId,
            @PathVariable Long scheduleId) {
        return ResponseEntity.ok(BaseResponse.success(
                "회차 포토카드 발급을 실행했습니다.",
                photocardIssuer.issueForSchedule(scheduleId)));
    }
}
