package com.teacat.server.inquiry.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.inquiry.dto.request.InquiryCreateRequest;
import com.teacat.server.inquiry.dto.request.InquiryUpdateRequest;
import com.teacat.server.inquiry.dto.response.InquiryPageResponse;
import com.teacat.server.inquiry.dto.response.InquiryResponse;
import com.teacat.server.inquiry.service.InquiryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "문의", description = "오류 신고 · 개선 제안 등 문의 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/inquiries")
@RequiredArgsConstructor
public class InquiryController {

    private static final int MAX_PAGE_SIZE = 50;

    private final InquiryService inquiryService;

    @Operation(summary = "문의 등록", description = "오류 · 개선 · 기타 중 하나로 문의를 남깁니다.")
    @PostMapping
    public ResponseEntity<BaseResponse<InquiryResponse>> create(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody InquiryCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(BaseResponse.success(
                "문의가 접수되었습니다.", inquiryService.create(authUser.id(), request)));
    }

    @Operation(summary = "내 문의 목록", description = "내가 남긴 문의를 최신순으로 봅니다.")
    @GetMapping
    public ResponseEntity<BaseResponse<InquiryPageResponse>> getMyInquiries(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(BaseResponse.success(
                inquiryService.getMyInquiries(authUser.id(), pageRequest(page, size))));
    }

    @Operation(summary = "내 문의 상세", description = "관리자 답변과 처리 상태를 함께 봅니다.")
    @GetMapping("/{inquiryId}")
    public ResponseEntity<BaseResponse<InquiryResponse>> getMyInquiry(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long inquiryId) {
        return ResponseEntity.ok(BaseResponse.success(
                inquiryService.getMyInquiry(authUser.id(), inquiryId)));
    }

    @Operation(
            summary = "문의 수정",
            description = "답변이 등록되기 전에만 수정할 수 있습니다. 답변이 달렸다면 409 로 거절합니다."
    )
    @PutMapping("/{inquiryId}")
    public ResponseEntity<BaseResponse<InquiryResponse>> update(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long inquiryId,
            @Valid @RequestBody InquiryUpdateRequest request) {
        return ResponseEntity.ok(BaseResponse.success(
                "문의가 수정되었습니다.", inquiryService.update(authUser.id(), inquiryId, request)));
    }

    @Operation(
            summary = "문의 삭제",
            description = "답변이 등록되기 전에만 삭제할 수 있습니다. 답변이 달린 글이 사라지면 대화가 끊긴 채로 남습니다."
    )
    @DeleteMapping("/{inquiryId}")
    public ResponseEntity<BaseResponse<Void>> delete(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long inquiryId) {
        inquiryService.delete(authUser.id(), inquiryId);
        return ResponseEntity.ok(BaseResponse.success("문의가 삭제되었습니다."));
    }

    /** 최신순 고정. size 는 상한을 둬서 한 번에 전부 긁어가지 못하게 한다 */
    private PageRequest pageRequest(int page, int size) {
        return PageRequest.of(
                Math.max(page, 0),
                Math.clamp(size, 1, MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "createdAt"));
    }
}
