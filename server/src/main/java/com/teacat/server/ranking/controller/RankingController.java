package com.teacat.server.ranking.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.ranking.dto.PopularConcertResponse;
import com.teacat.server.ranking.dto.PopularPhotocardResponse;
import com.teacat.server.ranking.service.RankingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/rankings")
@RequiredArgsConstructor
public class RankingController {

    private final RankingService rankingService;

    @GetMapping("/concerts")
    public ResponseEntity<BaseResponse<List<PopularConcertResponse>>> concerts() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofSeconds(45)).cachePublic())
                .body(BaseResponse.success(rankingService.popularConcerts()));
    }

    @GetMapping("/photocards")
    public ResponseEntity<BaseResponse<List<PopularPhotocardResponse>>> photocards() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofSeconds(45)).cachePublic())
                .body(BaseResponse.success(rankingService.popularPhotocards()));
    }
}
