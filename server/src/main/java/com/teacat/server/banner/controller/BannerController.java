package com.teacat.server.banner.controller;

import com.teacat.server.banner.dto.response.BannerResponse;
import com.teacat.server.banner.service.BannerService;
import com.teacat.server.common.response.BaseResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "메인 배너", description = "홈 상단 슬라이드 조회 API")
@RestController
@RequestMapping("/banners")
@RequiredArgsConstructor
public class BannerController {

    private final BannerService bannerService;

    @Operation(
            summary = "메인 배너 목록",
            description = "노출 중인 배너를 순서대로 내려줍니다. 비로그인도 볼 수 있습니다."
    )
    @GetMapping
    public ResponseEntity<BaseResponse<List<BannerResponse>>> getBanners() {
        return ResponseEntity.ok(BaseResponse.success(bannerService.getActiveBanners()));
    }
}
