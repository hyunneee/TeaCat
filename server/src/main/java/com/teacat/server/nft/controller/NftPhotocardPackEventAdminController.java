package com.teacat.server.nft.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.nft.dto.request.NftPhotocardPackEventActiveRequest;
import com.teacat.server.nft.dto.request.NftPhotocardPackEventCreateRequest;
import com.teacat.server.nft.dto.response.NftPhotocardPackEventResponse;
import com.teacat.server.nft.service.NftPhotocardPackEventService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "NFT 카드팩 이벤트 관리", description = "이벤트 카드팩을 열고 닫는 ADMIN API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/photocard-pack-events")
@RequiredArgsConstructor
public class NftPhotocardPackEventAdminController {

    private final NftPhotocardPackEventService eventService;

    @Operation(
            summary = "카드팩 이벤트 목록",
            description = """
                    ADMIN 전용 API입니다. 최신순으로 돌려줍니다.

                    - `active`는 스위치, `ongoing`은 **지금 실제로 지급되는지**입니다. 스위치가 켜져 있어도
                      시작 전이거나 종료됐으면 `ongoing`은 false입니다. 화면에는 둘 다 보여주세요.
                    - `grantedCount`는 그 이벤트로 지급된 카드팩 수입니다.
                    """
    )
    @GetMapping
    public ResponseEntity<BaseResponse<List<NftPhotocardPackEventResponse>>> findAll() {
        return ResponseEntity.ok(BaseResponse.success(eventService.findAll()));
    }

    @Operation(
            summary = "카드팩 이벤트 등록",
            description = """
                    ADMIN 전용 API입니다.

                    🔴 `code`는 지급된 팩의 출처로 남고 **계정당 1회**의 기준이 됩니다. 그래서 등록 뒤에는
                    바꿀 수 없습니다 — 바꾸면 이미 받은 사람이 또 받습니다. 새 이벤트가 필요하면 새로 등록하세요.

                    `startsAt`을 비우면 즉시 시작, `endsAt`을 비우면 무기한입니다.
                    진행 중인 이벤트가 둘 이상이면 **가장 최근에 시작한 것** 하나가 지급됩니다.
                    """
    )
    @PostMapping
    public ResponseEntity<BaseResponse<NftPhotocardPackEventResponse>> create(
            @Valid @RequestBody NftPhotocardPackEventCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(BaseResponse.success(
                "카드팩 이벤트가 등록되었습니다.",
                eventService.create(request)));
    }

    @Operation(
            summary = "카드팩 이벤트 열기/닫기",
            description = """
                    ADMIN 전용 API입니다. 스위치만 바꿉니다 — 기간과 코드는 그대로입니다.

                    닫아도 **이미 받은 팩은 회수되지 않습니다.** 앞으로 지급되지 않을 뿐입니다.
                    """
    )
    @PatchMapping("/{eventId}")
    public ResponseEntity<BaseResponse<NftPhotocardPackEventResponse>> changeActive(
            @Parameter(description = "이벤트 ID", example = "1") @PathVariable Long eventId,
            @Valid @RequestBody NftPhotocardPackEventActiveRequest request) {
        return ResponseEntity.ok(BaseResponse.success(
                eventService.changeActive(eventId, request.active())));
    }
}
