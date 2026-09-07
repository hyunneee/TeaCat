package com.teacat.server.stadium.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.stadium.dto.response.StadiumSummaryResponse;
import com.teacat.server.stadium.service.StadiumService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 명세(API-251)는 인증 불필요지만, 공개 경로(SecurityConfig.PUBLIC_ENDPOINTS)는
 * 규칙 변경 절차가 필요해 아직 등록하지 않았다. 지금은 로그인한 사용자만 호출할 수 있다.
 */
@Tag(name = "공연장", description = "공연장 조회 API")
@RestController
@RequestMapping("/stadiums")
@RequiredArgsConstructor
public class StadiumController {

    private final StadiumService stadiumService;

    @Operation(summary = "공연장 목록 조회", description = "등록된 공연장을 이름순으로 조회합니다.")
    @GetMapping
    public ResponseEntity<BaseResponse<List<StadiumSummaryResponse>>> getStadiums() {
        return ResponseEntity.ok(BaseResponse.success(stadiumService.getStadiums()));
    }
}
