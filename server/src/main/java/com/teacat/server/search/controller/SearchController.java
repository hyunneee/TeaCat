package com.teacat.server.search.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.search.dto.SearchRequest;
import com.teacat.server.search.dto.SearchTrendResponse;
import com.teacat.server.search.dto.UnifiedSearchResponse;
import com.teacat.server.search.service.SearchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;

@RestController
@RequestMapping("/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @PostMapping
    public ResponseEntity<BaseResponse<UnifiedSearchResponse>> search(
            @Valid @RequestBody SearchRequest request,
            @RequestHeader("X-Search-Session") String sessionId) {
        return ResponseEntity.ok(BaseResponse.success(searchService.search(request.keyword(), sessionId)));
    }

    @GetMapping("/trends")
    public ResponseEntity<BaseResponse<SearchTrendResponse>> trends() {
        SearchTrendResponse response = searchService.trends();
        long maxAge = Math.max(1, Duration.between(Instant.now(), response.nextRefreshAt()).toSeconds());
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofSeconds(maxAge)).cachePublic())
                .body(BaseResponse.success(response));
    }
}
