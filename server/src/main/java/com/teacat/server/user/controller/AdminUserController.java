package com.teacat.server.user.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.user.dto.request.AdminPasswordResetRequest;
import com.teacat.server.user.dto.request.AdminUserCreateRequest;
import com.teacat.server.user.dto.request.AdminUserUpdateRequest;
import com.teacat.server.user.dto.response.AdminUserPageResponse;
import com.teacat.server.user.dto.response.AdminUserResponse;
import com.teacat.server.user.dto.response.AdminUserStatsResponse;
import com.teacat.server.user.entity.UserRole;
import com.teacat.server.user.service.AdminUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자 대시보드의 회원 관리 API.
 *
 * <p>{@code /admin/**} 은 {@code SecurityConfig} 에서 ADMIN 전용이다.
 * STADIUM·PERFORMANCE 는 대시보드에는 들어올 수 있지만 이 API 는 403 이다
 * (프론트도 사이드바에서 회원 관리를 숨긴다).
 *
 * <p>본인 계정은 여기서 바꿀 수 없다 — 자기 역할을 내리거나 자기를 탈퇴시켜
 * 그 자리에서 대시보드를 잠그는 사고를 막는다. 본인 정보는 {@link UserController}.
 */
@Tag(name = "회원 관리", description = "관리자 대시보드용 회원 조회·생성·수정·탈퇴 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;

    @Operation(summary = "회원 목록 조회",
            description = "최근 가입 순입니다. keyword 는 이메일·이름·닉네임·전화번호 부분 일치이고, "
                    + "role 을 비우면 전체 역할을 봅니다. 탈퇴 회원은 나오지 않습니다.")
    @GetMapping
    public ResponseEntity<BaseResponse<AdminUserPageResponse>> list(
            @Parameter(description = "검색어 (이메일·이름·닉네임·전화번호)", example = "김싸피")
            @RequestParam(required = false) String keyword,
            @Parameter(description = "역할 필터. 비우면 전체", example = "USER")
            @RequestParam(required = false) UserRole role,
            @Parameter(description = "페이지 (0부터)", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "페이지 크기 (최대 100)", example = "20")
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(BaseResponse.success(adminUserService.list(keyword, role, page, size)));
    }

    @Operation(summary = "회원 요약 통계", description = "대시보드 카드에 쓰는 전체·역할별·얼굴등록·최근 7일 가입 수입니다.")
    @GetMapping("/stats")
    public ResponseEntity<BaseResponse<AdminUserStatsResponse>> stats() {
        return ResponseEntity.ok(BaseResponse.success(adminUserService.stats()));
    }

    @Operation(summary = "회원 상세 조회")
    @GetMapping("/{userId}")
    public ResponseEntity<BaseResponse<AdminUserResponse>> get(
            @Parameter(description = "회원 ID", example = "1") @PathVariable Long userId) {
        return ResponseEntity.ok(BaseResponse.success(adminUserService.get(userId)));
    }

    @Operation(summary = "회원 생성",
            description = "역할을 지정해 회원을 만듭니다. 역할을 지정할 수 있는 유일한 경로입니다 "
                    + "(일반 가입은 항상 USER). USER 로 만들면 일반 가입과 똑같이 지갑이 발급되고, "
                    + "운영진 역할(ADMIN·STADIUM·PERFORMANCE)은 지갑을 만들지 않습니다.")
    @PostMapping
    public ResponseEntity<BaseResponse<AdminUserResponse>> create(
            @Valid @RequestBody AdminUserCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success("회원이 생성되었습니다.", adminUserService.create(request)));
    }

    @Operation(summary = "회원 정보 수정",
            description = "보낸 필드만 변경합니다. 역할이 바뀌면 그 회원의 세션이 끊깁니다 "
                    + "(액세스 토큰에 역할이 담겨 있습니다). 이메일은 변경할 수 없습니다.")
    @PatchMapping("/{userId}")
    public ResponseEntity<BaseResponse<AdminUserResponse>> update(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "회원 ID", example = "1") @PathVariable Long userId,
            @Valid @RequestBody AdminUserUpdateRequest request) {
        return ResponseEntity.ok(BaseResponse.success("회원 정보가 수정되었습니다.",
                adminUserService.update(authUser.id(), userId, request)));
    }

    @Operation(summary = "비밀번호 초기화",
            description = "현재 비밀번호를 묻지 않고 새로 정합니다. 그 회원의 모든 세션이 끊깁니다. "
                    + "SSAFY 계정 전용 회원은 비밀번호가 없어 거절됩니다.")
    @PatchMapping("/{userId}/password")
    public ResponseEntity<BaseResponse<Void>> resetPassword(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "회원 ID", example = "1") @PathVariable Long userId,
            @Valid @RequestBody AdminPasswordResetRequest request) {
        adminUserService.resetPassword(authUser.id(), userId, request);
        return ResponseEntity.ok(BaseResponse.success("비밀번호가 초기화되었습니다."));
    }

    @Operation(summary = "회원 얼굴 정보 삭제",
            description = "등록된 얼굴을 지웁니다. 다시 등록하는 것은 본인만 할 수 있습니다.")
    @DeleteMapping("/{userId}/face")
    public ResponseEntity<BaseResponse<Void>> deleteFace(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "회원 ID", example = "1") @PathVariable Long userId) {
        adminUserService.deleteFace(authUser.id(), userId);
        return ResponseEntity.ok(BaseResponse.success("얼굴 정보가 삭제되었습니다."));
    }

    @Operation(summary = "회원 탈퇴 처리",
            description = "소프트 삭제입니다. 얼굴 정보는 즉시 파기되고 세션이 끊깁니다. "
                    + "발권 이력이 남아 있어 행 자체는 지우지 않습니다. "
                    + "마지막 ADMIN 계정은 탈퇴시킬 수 없습니다.")
    @DeleteMapping("/{userId}")
    public ResponseEntity<BaseResponse<Void>> withdraw(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "회원 ID", example = "1") @PathVariable Long userId) {
        adminUserService.withdraw(authUser.id(), userId);
        return ResponseEntity.ok(BaseResponse.success("회원이 탈퇴 처리되었습니다."));
    }
}
