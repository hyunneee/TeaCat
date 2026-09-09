package com.teacat.server.inquiry.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.inquiry.dto.request.InquiryAnswerRequest;
import com.teacat.server.inquiry.dto.response.InquiryPageResponse;
import com.teacat.server.inquiry.dto.response.InquiryResponse;
import com.teacat.server.inquiry.dto.response.InquiryStatsResponse;
import com.teacat.server.inquiry.entity.InquiryStatus;
import com.teacat.server.inquiry.entity.InquiryType;
import com.teacat.server.inquiry.service.AdminInquiryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 문의 관리 (ADMIN 전용).
 *
 * /admin/** 는 SecurityConfig 의 포괄 규칙이 ADMIN 으로 잠근다.
 * 이 컨트롤러에 별도 권한 애너테이션이 없는 이유다.
 */
@Tag(name = "문의 관리", description = "관리자 문의 조회 · 답변 · 해결 처리 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/inquiries")
@RequiredArgsConstructor
public class AdminInquiryController {

    private static final int MAX_PAGE_SIZE = 100;

    private final AdminInquiryService adminInquiryService;

    @Operation(
            summary = "문의 목록",
            description = "상태·유형으로 걸러서 최신순으로 봅니다. 값을 주지 않으면 전부 보입니다."
    )
    @GetMapping
    public ResponseEntity<BaseResponse<InquiryPageResponse>> search(
            @RequestParam(required = false) InquiryStatus status,
            @RequestParam(required = false) InquiryType type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(BaseResponse.success(
                adminInquiryService.search(status, type, pageRequest(page, size))));
    }

    @Operation(summary = "문의 처리 현황", description = "답변 대기 · 답변 완료 · 해결 완료 건수입니다.")
    @GetMapping("/stats")
    public ResponseEntity<BaseResponse<InquiryStatsResponse>> getStats() {
        return ResponseEntity.ok(BaseResponse.success(adminInquiryService.getStats()));
    }

    @Operation(summary = "문의 상세")
    @GetMapping("/{inquiryId}")
    public ResponseEntity<BaseResponse<InquiryResponse>> get(@PathVariable Long inquiryId) {
        return ResponseEntity.ok(BaseResponse.success(adminInquiryService.get(inquiryId)));
    }

    @Operation(
            summary = "답변 등록 · 수정",
            description = "처음 답하면 상태가 답변 완료로 넘어갑니다. 이미 답한 문의면 내용만 고칩니다."
    )
    @PutMapping("/{inquiryId}/answer")
    public ResponseEntity<BaseResponse<InquiryResponse>> answer(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long inquiryId,
            @Valid @RequestBody InquiryAnswerRequest request) {
        return ResponseEntity.ok(BaseResponse.success(
                "답변이 등록되었습니다.", adminInquiryService.answer(authUser.id(), inquiryId, request)));
    }

    @Operation(
            summary = "해결 처리",
            description = "답변을 등록한 뒤에만 누를 수 있습니다."
    )
    @PostMapping("/{inquiryId}/resolve")
    public ResponseEntity<BaseResponse<InquiryResponse>> resolve(@PathVariable Long inquiryId) {
        return ResponseEntity.ok(BaseResponse.success(
                "해결 처리되었습니다.", adminInquiryService.resolve(inquiryId)));
    }

    @Operation(summary = "해결 취소", description = "잘못 눌렀거나 다시 문제가 된 경우 답변 완료 상태로 되돌립니다.")
    @PostMapping("/{inquiryId}/reopen")
    public ResponseEntity<BaseResponse<InquiryResponse>> reopen(@PathVariable Long inquiryId) {
        return ResponseEntity.ok(BaseResponse.success(
                "해결 처리를 취소했습니다.", adminInquiryService.reopen(inquiryId)));
    }

    private PageRequest pageRequest(int page, int size) {
        return PageRequest.of(
                Math.max(page, 0),
                Math.clamp(size, 1, MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "createdAt"));
    }
}
