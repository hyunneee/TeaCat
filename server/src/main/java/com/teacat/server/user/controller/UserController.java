package com.teacat.server.user.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.user.dto.request.FaceRegisterRequest;
import com.teacat.server.user.dto.request.NicknameChangeRequest;
import com.teacat.server.user.dto.request.PasswordChangeRequest;
import com.teacat.server.user.dto.response.MyInfoResponse;
import com.teacat.server.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "회원", description = "회원 정보 · 얼굴 정보 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/users/me")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @Operation(summary = "내 정보 조회", description = "인증 사용자와 얼굴 등록 · 잔액 정보를 조회합니다.")
    @GetMapping
    public ResponseEntity<BaseResponse<MyInfoResponse>> getMyInfo(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success(userService.getMyInfo(authUser.id())));
    }

    @Operation(summary = "비밀번호 변경", description = "현재 비밀번호를 검증한 뒤 변경합니다.")
    @PatchMapping("/password")
    public ResponseEntity<BaseResponse<Void>> changePassword(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody PasswordChangeRequest request) {
        userService.changePassword(authUser.id(), request);
        return ResponseEntity.ok(BaseResponse.success("비밀번호가 변경되었습니다."));
    }

    @Operation(summary = "닉네임 변경")
    @PatchMapping("/nickname")
    public ResponseEntity<BaseResponse<Void>> changeNickname(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody NicknameChangeRequest request) {
        userService.changeNickname(authUser.id(), request);
        return ResponseEntity.ok(BaseResponse.success("닉네임이 변경되었습니다."));
    }

    @Operation(summary = "회원 탈퇴", description = "계정 탈퇴 및 개인정보 파기 절차를 시작합니다.")
    @DeleteMapping
    public ResponseEntity<BaseResponse<Void>> withdraw(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        userService.withdraw(authUser.id());
        return ResponseEntity.ok(BaseResponse.success("회원 탈퇴가 완료되었습니다."));
    }

    @Operation(summary = "얼굴 정보 등록", description = "클라이언트에서 추출한 얼굴 특징값을 저장합니다.")
    @PostMapping("/face")
    public ResponseEntity<BaseResponse<Void>> registerFace(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody FaceRegisterRequest request) {
        userService.registerFace(authUser.id(), request);
        return ResponseEntity.ok(BaseResponse.success("얼굴 정보가 등록되었습니다."));
    }

    @Operation(summary = "얼굴 정보 삭제", description = "저장된 얼굴 특징값을 삭제합니다.")
    @DeleteMapping("/face")
    public ResponseEntity<BaseResponse<Void>> deleteFace(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        userService.deleteFace(authUser.id());
        return ResponseEntity.ok(BaseResponse.success("얼굴 정보가 삭제되었습니다."));
    }
}
