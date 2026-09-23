package com.teacat.server.nft.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.nft.dto.request.NftPhotocardTemplateCreateRequest;
import com.teacat.server.nft.dto.request.NftPhotocardTemplateHiddenRequest;
import com.teacat.server.nft.dto.response.NftPhotocardTemplateResponse;
import com.teacat.server.nft.service.NftPhotocardTemplateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@Tag(name = "NFT 포토카드 템플릿", description = "카드 그림을 등록하는 ADMIN·공연 기획자 API (수량 없음)")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/photocard-templates")
@RequiredArgsConstructor
public class NftPhotocardTemplateAdminController {

    private final NftPhotocardTemplateService templateService;

    @Operation(
            summary = "템플릿 등록",
            description = """
                    ADMIN 또는 공연 기획자 API입니다. 카드 그림을 등록합니다 — **수량을 받지 않습니다.**

                    몇 장 발행할지는 이 템플릿을 공연이나 이벤트에 넣을 때 정합니다
                    (`POST /admin/performances/{id}/draw-designs`). 그래서 이 요청은 **이미지 IPFS 핀
                    한 번**으로 끝나고 **온체인 등록이 나가지 않습니다.** 쓰지 않을 카드가 체인에
                    박히지 않습니다.
                    """
    )
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BaseResponse<NftPhotocardTemplateResponse>> create(
            @Valid @ModelAttribute NftPhotocardTemplateCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(BaseResponse.success(
                "템플릿이 등록되었습니다.",
                templateService.create(request)));
    }

    @Operation(
            summary = "템플릿 목록",
            description = """
                    ADMIN 또는 공연 기획자 API입니다. hidden=false(기본)는 공개 목록, hidden=true는 숨김 목록입니다. 최신순입니다.

                    `usedCount`는 이 템플릿으로 만든 도안 수입니다(공연 + 이벤트 합계).
                    """
    )
    @GetMapping
    public ResponseEntity<BaseResponse<List<NftPhotocardTemplateResponse>>> findAll(
            @RequestParam(defaultValue = "false") boolean hidden) {
        return ResponseEntity.ok(BaseResponse.success(templateService.findAll(hidden)));
    }

    @Operation(
            summary = "템플릿 감추기 / 되살리기",
            description = """
                    ADMIN 전용 API입니다. **삭제가 없습니다.**

                    🔴 이 템플릿으로 만든 도안들이 같은 이미지 CID를 가리키고 있어서, 지우거나
                    IPFS에서 언핀하면 **그 그림을 쓰는 모든 도안의 이미지가 깨집니다.** 온체인 등록도
                    되돌릴 수 없습니다. 그래서 목록에서 감추는 것까지만 합니다 — 이미 만든 도안은
                    그대로 동작합니다.
                    """
    )
    @PatchMapping("/{templateId}")
    public ResponseEntity<BaseResponse<NftPhotocardTemplateResponse>> changeHidden(
            @Parameter(description = "템플릿 ID", example = "1") @PathVariable Long templateId,
            @Valid @RequestBody NftPhotocardTemplateHiddenRequest request) {
        return ResponseEntity.ok(BaseResponse.success(
                templateService.changeHidden(templateId, request.hidden())));
    }
}
