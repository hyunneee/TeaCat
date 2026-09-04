package com.teacat.server.wallet.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.wallet.dto.response.BalanceResponse;
import com.teacat.server.wallet.service.CatMoneyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "지갑", description = "캣머니 잔액 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/users/me")
@RequiredArgsConstructor
public class WalletController {

    private final CatMoneyService catMoneyService;

    @Operation(
            summary = "내 캣머니 잔액 조회",
            description = "체인에서 바로 읽어옵니다. 서버는 잔액을 저장하지 않습니다."
    )
    @GetMapping("/balance")
    public ResponseEntity<BaseResponse<BalanceResponse>> getMyBalance(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success(catMoneyService.getBalance(authUser.id())));
    }
}
