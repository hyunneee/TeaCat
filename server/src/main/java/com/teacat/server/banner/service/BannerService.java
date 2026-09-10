package com.teacat.server.banner.service;

import com.teacat.server.banner.dto.response.BannerResponse;
import com.teacat.server.banner.entity.MainBanner;
import com.teacat.server.banner.repository.MainBannerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 홈에 뿌리는 배너 조회.
 *
 * 비로그인도 보는 화면이라 인증이 없다 (SecurityConfig 의 PUBLIC_GET_ENDPOINTS).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BannerService {

    private final MainBannerRepository mainBannerRepository;
    private final BannerImageResolver bannerImageResolver;

    public List<BannerResponse> getActiveBanners() {
        return mainBannerRepository.findByActiveTrueOrderBySortOrderAscIdAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    private BannerResponse toResponse(MainBanner banner) {
        return BannerResponse.of(banner, bannerImageResolver.resolveImageUrl(banner));
    }
}
